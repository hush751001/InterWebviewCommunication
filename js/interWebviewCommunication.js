!(function (global) {
  global.webviewCallbacks = {};

  var funcCnt = 0;

  function makeParamsString(...params) {
    function makeFunction(func) {
      var fName = 'funcToCall_' + funcCnt++;
      global.webviewCallbacks[fName] = function () {
        var args = Array.prototype.slice.call(arguments, 0);
        var ret = func.apply(null, args);
        if (ret !== true) {
          delete global.webviewCallbacks[fName];
        }
      };
      return ':' + fName + ':';
    }

    function makeParamWithObject(obj) {
      // obj를 하위 써치해서 function일때만 문자열로 바꾼다.
      traverseForMakeParamWithObject(obj);
      return obj;
    }

    function traverseForMakeParamWithObject(obj) {
      for (var k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
          traverseForMakeParamWithObject(obj[k]);
        } else {
          if (obj[k] && typeof obj[k] === 'function') {
            obj[k] = makeFunction(obj[k]);
          }
        }
      }
    }

    return JSON.stringify(
      params.map(function (param) {
        if (
          typeof param === 'boolean' ||
          typeof param === 'number' ||
          typeof param === 'string'
        ) {
          return param;
        } else if (typeof param === 'function') {
          return makeFunction(param);
        } else if (typeof param === 'object') {
          // item중에 function은 없다는 가정을 해야함.
          return makeParamWithObject(param);
        }
      })
    );
  }

  function execute(targetWebviewID, req) {
    function traverse(obj) {
      for (var k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
          traverse(obj[k]);
        } else {
          if (obj[k] && typeof obj[k] === 'string') {
            if (/^:[\w\W]+:$/.test(obj[k])) {
              var fName = /^:([\w\W]+):$/.exec(obj[k])[1];
              obj[k] = function () {
                var args = Array.prototype.slice.call(arguments, 0);
                invoke({
                  targetWebviewID: targetWebviewID,
                  namespace: 'webviewCallbacks',
                  functionName: fName,
                  params: args,
                });
              };
            }
          }
        }
      }
    }

    var functionName = global[req.namespace][req.functionName];
    var params = JSON.parse(req.params);
    params = params.map(function (param) {
      if (typeof param === 'string') {
        // function이면...
        if (/^:[\w\W]+:$/.test(param)) {
          var fName = /^:([\w\W]+):$/.exec(param)[1];
          return function () {
            var args = Array.prototype.slice.call(arguments, 0);
            invoke({
              targetWebviewID: targetWebviewID,
              namespace: 'webviewCallbacks',
              functionName: fName,
              params: args,
            });
          };
        }
      } else if (typeof param === 'object') {
        traverse(param);
      }
      return param;
    });

    functionName.apply(null, params);
  }

  function invoke(req) {
    req.params = makeParamsString.apply(null, req.params);
    var reqString = JSON.stringify(req);

    // android bridge일때
    if (window.android && window.android.invoke) {
      window.android.invoke.postMessage({
        targetWebviewID: req.targetWebviewID,
        data: reqString,
      });
    }
    // ios bridge일때
    else if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.invoke
    ) {
      window.webkit.messageHandlers.invoke.postMessage({
        targetWebviewID: req.targetWebviewID,
        data: reqString,
      });
    } else {
      // iframe일때
      parent.postMessage(reqString, '*');
    }
  }

  var IWC = {
    setWebviewID: function (webviewID) {
      IWC.webviewID = webviewID;

      if (window.android && window.android.invoke) {
        window.android.setWebviewID.postMessage(webviewID);
      }
      // ios bridge일때
      else if (
        window.webkit &&
        window.webkit.messageHandlers &&
        window.webkit.messageHandlers.setWebviewID
      ) {
        window.webkit.messageHandlers.setWebviewID.postMessage(webviewID);
      }

      // Native에서 던진 message를 받는다.
      window.addEventListener('message', function (e) {
        var message = e.data;
        if (message.data) {
          var req = message.data;
          if (typeof message.data === 'string') {
            req = JSON.parse(message.data);
          }
          execute(message.sourceWebviewID, req);
        }
      });
    },
    addMethod: function (fName, func) {
      global.FunctionsProvider = global.FunctionsProvider || {};
      global.FunctionsProvider[fName] = func;
    },
    invokeMethod: function (webViewID, functionName, params) {
      invoke({
        targetWebviewID: webViewID,
        namespace: 'FunctionsProvider',
        functionName: functionName,
        params: params,
      });
    },
  };

  global.IWC = IWC;
})(this);
