import IWC from '../../../lib/index';

var webviewID = 'webview1';
IWC.setWebviewId(webviewID);

function btnSendOnClick() {
  IWC.invokeMethod('webview2', 'favoriteLanguage', [
    '가장 좋아하는 프로그래밍 언어는?',
    {
      answers: [
        'JavaScript',
        'TypeScript',
        'Swift',
        'Kotlin',
        'Python',
        'Java',
        'C++',
        'C',
      ],
      callback: function (status: string, cb: Function) {
        console.log(status);
        cb("i'm ok");
      },
    },
    function (answer: string, keepAlive: boolean) {
      const $answer = document.getElementById('answer');
      if ($answer) {
        $answer.innerHTML = answer;
      }
      return keepAlive;
    },
  ]);
}

// 버튼 클릭 이벤트 등록
window.addEventListener('DOMContentLoaded', function () {
  const btnSend = document.getElementById('btnSend');
  btnSend?.addEventListener('click', btnSendOnClick, false);
});
