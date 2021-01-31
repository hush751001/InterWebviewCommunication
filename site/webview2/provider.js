!(function (global) {
  var webviewID = 'webview2';
  IWC.setWebviewID(webviewID);

  IWC.addMethod('favoriteLanguage', function (title, data, completed) {
    // 1. title 표시
    document.getElementById('title').innerHTML = title;
    // 2. answers 표시
    var strHtml = data.answers
      .map(function (answer) {
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
    document.getElementById('answers').innerHTML = strHtml;

    // 3. 제출 버튼 활성화
    var btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = false;
    btnSubmit.addEventListener('click', btnSubmitOnClick, false);

    data.callback('are you ok?', function (status) {
      console.log(status);
    });

    function btnSubmitOnClick(e) {
      var answer = document.querySelector('[name=answer]:checked').value;
      completed(answer, true);
    }
  });
})(this);
