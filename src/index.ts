export type FnType = (...args: any) => void|boolean|Promise<void|boolean>
export interface WebViewCallbacks {
  [key: string]: FnType;
}

declare global {
  interface Window {
    android: any;
    webkit: any;
    webviewCallbacks: WebViewCallbacks
    functionsProvider: WebViewCallbacks;
  }
}

type IJSON = string|number|boolean|FnType|Object|Array<IJSON>;

let funcCnt = 0;
window.webviewCallbacks = {};

/**
 * 다른 WebView에서 제공하는 함수를 호출하기 위한 파라미터 생성
 * @param params 파라미터의 배열
 * @returns 
 */
function makeParamsString(params: Array<IJSON>) {
  function makeFunction(func: FnType) {
    const fName = `funcToCall_${funcCnt++}`;
    window.webviewCallbacks[fName] = function (...args) {
      const result = func(...args);
      if (result instanceof (Promise)) {
        result.then((res) => {
          if (res !== true) {
            delete window.webviewCallbacks[fName];
          }
        });
      } else {
        if (result !== true) {
          delete window.webviewCallbacks[fName];
        }
      }
    };
    return `:${fName}:`;
  }

  function makeParamWithObject(obj: Object) {
    // obj를 하위 써치해서 function일때만 문자열로 바꾼다.
    traverseForMakeParamWithObject(obj);
    return obj;
  }

  function traverseForMakeParamWithObject(obj: Object) {
    for (const k in obj) {
      if (obj[k] && typeof obj[k] === 'object') {
        traverseForMakeParamWithObject(obj[k] as IJSON);
      } else {
        if (obj[k] && typeof obj[k] === 'function') {
          obj[k] = makeFunction(obj[k] as FnType);
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
        return makeFunction(param as FnType);
      } else if (typeof param === 'object') {
        // item중에 function은 없다는 가정을 해야함.
        return makeParamWithObject(param as Object);
      }
      return '';
    })
  );
}

interface IReq {
  targetWebviewId: string;
  providerName: string;
  functionName: string;
  params: Array<IJSON> | string;
}

window.functionsProvider = {};


/**
 * 타 WebView에서 제공하는 함수를 호출한다.
 * @param targetWebviewId 호출할 WebView의 Id
 * @param req 호출할 WebView에서 제공하는 함수 호출 정보
 */
function execute(targetWebviewId: string, req: IReq) {
  function hasFunctionMark(param: string) {
    return /^:[\w\W]+:$/.test(param);
  }
  function getFunctionName(param: string) {
    return /^:([\w\W]+):$/.exec(param)?.[1] as string;
  }
  function traverse(obj: Object) {
    for (const k in obj) {
      if (obj[k] && typeof obj[k] === 'object') {
        traverse(obj[k] as Object);
      } else {
        if (obj[k] && typeof obj[k] === 'string') {
          const strData = obj[k] as string;
          if (hasFunctionMark(strData)) {
            const functionName = getFunctionName(strData);
            obj[k] = function (...args) {
              invoke({
                targetWebviewId,
                providerName: 'webviewCallbacks',
                functionName,
                params: args,
              });
            };
          }
        }
      }
    }
  }

  const func = (window as any)[req.providerName][req.functionName] as FnType;
  var params = JSON.parse(req.params as string) as Array<IJSON>;
  params = params.map(function (param: IJSON) {
    if (typeof param === 'string') {
      if (hasFunctionMark(param)) {
        const functionName = getFunctionName(param);
        return function (...args) {
          invoke({
            targetWebviewId,
            providerName: 'webviewCallbacks',
            functionName,
            params: args,
          });
        };
      }
    } else if (typeof param === 'object') {
      traverse(param as Object);
    }
    return param;
  });

  func(...params);
}

/**
 * 타 WebView에 함수 호출 정보를 전달한다.
 * @param req 호출할 WebView에서 제공하는 함수 호출 정보
 */
function invoke(req: IReq) {
  req.params = makeParamsString(req.params as Array<IJSON>);
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
  addMethod(fName: string, func: FnType) {
    window.functionsProvider[fName] = func;
  },
  invokeMethod(webViewId: string, functionName: string, params: Array<any>) {
    invoke({
      targetWebviewId: webViewId,
      providerName: 'functionsProvider',
      functionName,
      params,
    });
  }
}
