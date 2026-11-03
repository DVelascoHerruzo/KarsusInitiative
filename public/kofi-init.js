// The Ko-fi support button, kept off the screens the table watches (the visual view and the demo's).
if (typeof kofiWidgetOverlay !== 'undefined' && !/^\/(play\/|demo\/play|encounters\/[^/]+\/view)/.test(window.location.pathname)) {
  kofiWidgetOverlay.draw('barope', {
    type: 'floating-chat',
    'floating-chat.donateButton.text': 'Support Us',
    'floating-chat.donateButton.background-color': '#fcbf47',
    'floating-chat.donateButton.text-color': '#323842',
  })
}
