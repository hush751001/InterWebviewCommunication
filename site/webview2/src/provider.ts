import IWC from '../../../lib/index';

var webviewID = 'webview2';
IWC.setWebviewId(webviewID);

IWC.addMethod('favoriteLanguage', function (title: string, data: any, completed: Function) {
  // 1. title 표시
  const $title = document.getElementById('title');
  if ($title) {
    $title.innerHTML = title;
  }

  // 2. answers 표시
  var strHtml = data.answers
    .map(function (answer: string) {
      var html = '';
      html += '<li><label>';
      html +=
        '<input type="radio" name="answer" value="' +
        answer +
        '" />' +
        answer;
      html += '</label></li>';
      return html;
    })
    .join('');

  const $answer = document.getElementById('answers');
  if ($answer) {
    $answer.innerHTML = strHtml;
  }

  // 3. 제출 버튼 활성화
  const $btnSubmit = document.getElementById('btnSubmit') as HTMLButtonElement;
  if ($btnSubmit) {
    $btnSubmit.disabled = false;
    $btnSubmit.addEventListener('click', btnSubmitOnClick, false);
  }

  data.callback('are you ok?', function (status: string) {
    console.log(status);
  });

  function btnSubmitOnClick() {
    const $answer = document.querySelector('[name=answer]:checked') as HTMLInputElement;
    if ($answer) {
      completed($answer.value, true);
    }
  }
});
