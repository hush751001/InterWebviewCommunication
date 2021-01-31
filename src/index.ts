interface WebViewCallbacks {
  [key: string]: Function;
}

declare global {
  interface Window {
    android: any;
    webkit: any;
    webviewCallbacks: WebViewCallbacks
    FunctionsProvider: WebViewCallbacks;
  }
}

interface IJSON {
  [key: string]: string|number|boolean|Function|Object|Array<any>;
}

interface IReq {
  targetWebviewId: string;
  namespace: string;
  functionName: string;
  params: Array<any> | string;
}

let funcCnt = 0;

window.webviewCallbacks = {};
window.FunctionsProvider = {};

function makeParamsString(params: Array<any>) {
  function makeFunction(func: Function) {
    var fName = 'funcToCall_' + funcCnt++;
    window.webviewCallbacks[fName] = function () {
      var args = Array.prototype.slice.call(arguments, 0);
      var ret = func.apply(null, args);
      if (ret !== true) {
        delete window.webviewCallbacks[fName];
      }
    };
    return ':' + fName + ':';
  }

  function makeParamWithObject(obj: IJSON) {
    // obj를 하위 써치해서 function일때만 문자열로 바꾼다.
    traverseForMakeParamWithObject(obj);
    return obj;
  }

  function traverseForMakeParamWithObject(obj: IJSON) {
    for (var k in obj) {
      if (obj[k] && typeof obj[k] === 'object') {
        traverseForMakeParamWithObject(obj[k] as IJSON);
      } else {
        if (obj[k] && typeof obj[k] === 'function') {
          obj[k] = makeFunction(obj[k] as Function);
        }
      }
    }
  }

  return JSON.stringify(
    params.map(function (param: IJSON) {
      if (
        typeof param === 'boolean' ||
        typeof param === 'number' ||
        typeof param === 'string'
      ) {
        return param;
      } 
      else if (typeof param === 'function') {
        return makeFunction(param);
      } else if (typeof param === 'object') {
        // item중에 function은 없다는 가정을 해야함.
        return makeParamWithObject(param);
      }
      return '';
    })
  );
}

function execute(targetWebviewId: string, req: IReq) {
  function traverse(obj: IJSON) {
    for (var k in obj) {
      if (obj[k] && typeof obj[k] === 'object') {
        traverse(obj[k] as IJSON);
      } else {
        // Function key인 경우
        if (obj[k] && typeof obj[k] === 'string') {
          const strData = obj[k] as string;
          if (/^:[\w\W]+:$/.test(strData)) {
            var fName = /^:([\w\W]+):$/.exec(strData)?.[1];
            if (fName) {
              obj[k] = function () {
                var args = Array.prototype.slice.call(arguments, 0);
                invoke({
                  targetWebviewId,
                  namespace: 'webviewCallbacks',
                  functionName: fName!,
                  params: args,
                });
              };
            } else {
              // 에러
            }
          }
        }
      }
    }
  }

  var functionName = (window as any)[req.namespace][req.functionName];
  var params = JSON.parse(req.params as string) as Array<any>;
  params = params.map(function (param) {
    if (typeof param === 'string') {
      // function이면...
      if (/^:[\w\W]+:$/.test(param)) {
        var fName = /^:([\w\W]+):$/.exec(param)?.[1];
        return function () {
          var params = Array.prototype.slice.call(arguments, 0);
          invoke({
            targetWebviewId,
            namespace: 'webviewCallbacks',
            functionName: fName!,
            params
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

function invoke(req: IReq) {
  req.params = makeParamsString(req.params as Array<any>);
  var reqString = JSON.stringify(req);

  // android bridge일때
  if (window.android && window.android.invoke) {
    window.android.invoke.postMessage({
      targetWebviewId: req.targetWebviewId,
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
      targetWebviewId: req.targetWebviewId,
      data: reqString,
    });
  } else {
    parent.postMessage({
      'command': 'invoke',
      'params': reqString
    }, '*');
  }
}

export default {
  setWebviewId(webviewId: string) {
    if (window.android && window.android.invoke) {
      window.android.setWebviewId.postMessage(webviewId);
    }
    // ios bridge일때
    else if (
      window.webkit &&
      window.webkit.messageHandlers &&
      window.webkit.messageHandlers.setWebviewId
    ) {
      window.webkit.messageHandlers.setWebviewId.postMessage(webviewId);
    } else {
      parent.postMessage({
        'command': 'setWebviewId',
        'params': webviewId
      }, '*');
    }

    // Native에서 던진 message를 받는다.
    window.addEventListener('message', function (e) {
      const message = e.data;
      if (message.data) {
        var targetWebviewIdForResult = message.sourceWebviewId;
        var req = message.data;
        if (typeof message.data === 'string') {
          req = JSON.parse(message.data);
        }

        // sourceWebviewId는 실제 타켓임.
        execute(targetWebviewIdForResult, req);
      }
    });
  },
  addMethod(fName: string, func: Function) {
    window.FunctionsProvider[fName] = func;
  },
  invokeMethod(webViewId: string, functionName: string, params: Array<any>) {
    invoke({
      targetWebviewId: webViewId,
      namespace: 'FunctionsProvider',
      functionName,
      params,
    });
  }
}
