/* Vitalis Tower — /webinar/pro/watch/ — floor plans & pricing form.

   Creates the Typeform (ONDEMAND.TYPEFORM_ID) as soon as the page loads, so
   visitors can fill it in right away. It opens in the language the viewer
   is watching (hidden field "lang"), and the page's UTM / ad parameters are
   passed through to its hidden fields. */
(function () {
  'use strict';
  var OD = (window.VITALIS || {}).ONDEMAND || {};
  var FORM_ID = OD.TYPEFORM_ID;
  var box = document.getElementById('w-form-embed');
  if (!box || !FORM_ID) return;

  var PASS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
              'campaign_id', 'adset_id', 'ad_id', 'fbclid'];

  function tr(key, fallback) {
    var I = window.VITALIS_I18N;
    return I && I.t ? I.t(key, fallback) : fallback;
  }
  function viewerLang() {
    var video = document.getElementById('wv');
    return (video && video.getAttribute('lang')) ||
           (window.VITALIS_I18N && window.VITALIS_I18N.lang) || 'en';
  }

  function mount(tf) {
    var holder = document.createElement('div');
    holder.className = 'w-form-tf';
    box.appendChild(holder);
    tf.createWidget(FORM_ID, {
      container: holder,
      opacity: 100,
      medium: 'snippet',
      inlineOnMobile: true,
      transitiveSearchParams: PASS,
      hidden: { lang: viewerLang() },
      iframeProps: { title: tr('tf_title', 'Vitalis Tower – Floor plans & pricing') }
    });
  }

  // The Typeform embed script loads just before this one; wait briefly if it's late.
  if (window.tf && window.tf.createWidget) { mount(window.tf); return; }
  var tries = 0;
  var iv = setInterval(function () {
    if (window.tf && window.tf.createWidget) { clearInterval(iv); mount(window.tf); }
    else if (++tries > 150) clearInterval(iv); // give up after ~15s
  }, 100);
})();
