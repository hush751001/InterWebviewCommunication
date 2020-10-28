// IWC에서 invoke한 메시지를 받아서
window.addEventListener('message', function (e) {
  var sourceWebviewID = e.source.IWC.webviewID;
  var data = {};
  try {
    data = JSON.parse(e.data);
  } catch (e) {}

  var targetWebviewID = data.targetWebviewID;
  if (targetWebviewID) {
    var iframe = document.getElementById(targetWebviewID);
    var message = {
      sourceWebviewID: sourceWebviewID,
      data: e.data,
    };
    iframe.contentWindow.postMessage(message);
  }
});
