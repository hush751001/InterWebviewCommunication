var webviewIds = {}
// IWC에서 invoke한 메시지를 받아서
window.addEventListener('message', function (e) {
  if (e.data) {
    if (e.data.command === 'setWebviewId') {
      const id = e.data.params
      webviewIds[id] = e.source
    } else if (e.data.command === 'invoke') {
      for (let webviewId in webviewIds) {
        if (webviewIds[webviewId] === e.source) {
          const params = JSON.parse(e.data.params)
          const targetWebviewId = params.targetWebviewId
          if (targetWebviewId) {
            var iframe = document.getElementById(targetWebviewId)
            var message = {
              sourceWebviewId: webviewId,
              data: params
            }
            iframe.contentWindow.postMessage(message, '*')
          }
          break
        }
      }
    }
  }
})
