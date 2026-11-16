/* Vitalis Tower — /webinar/pro/ and /webinar/pro/watch/ — page language from the link.

   Ads link to the registration page with ?lang=es or ?lang=en; the page
   shows that language, carries ?lang= on to the watch page (which also
   plays the matching webinar), and with no parameter shows English. The choice is remembered in
   this browser, so a later visit without ?lang= (e.g. the ?watch=1 email
   link) keeps the same language. English lives in the HTML; this file only
   swaps in Spanish:
     data-i18n="key"            → textContent
     data-i18n-html="key"       → innerHTML (static markup from this file)
     data-i18n-attr="attr:key"  → attribute(s), ";"-separated
   Scripts read strings through window.VITALIS_I18N.t(key, englishFallback).
   Testimonial quotes stay verbatim in English, as on vitalistower.com/es. */
(function () {
  'use strict';
  var LANG_KEY = 'vitalis.webinar.lang'; // shared with watch-kit.js (video choice)

  var ES = {
    title_watch: 'Ver el webinar — Ingresos Pasivos | Vitalis Tower',
    desc_watch: 'Webinar de Ingresos Pasivos: cómo generar ingresos pasivos invirtiendo en bienes raíces comerciales, presentado por el desarrollador Bernardo Rieber.',

    kicker: 'Webinar de Ingresos Pasivos',
    hero_title: 'Ya tiene acceso<span class="t-colon">.</span>',
    hosted: 'Presentado por <strong>Bernardo&nbsp;Rieber</strong>, desarrollador inmobiliario',
    stage_label: 'El webinar',
    sound: 'Activar sonido',
    video_label: 'Webinar de Ingresos Pasivos (Español)',

    share_label: 'Guarde o comparta el enlace',
    share_sub: 'Envíelo a un amigo',
    share_go: 'Compartir',
    dropbox_sub: 'Conozca más sobre el proyecto',
    dropbox_go: 'Abrir Dropbox',
    contact_label: 'Guarde nuestro número',
    contact_go: 'Guardar contacto',
    copy: 'Copiar enlace',
    email: 'Correo',
    sms: 'Mensaje de texto',
    share_url: 'Enlace para compartir',
    copied: 'Enlace copiado ✓',
    link_pending: 'Enlace pendiente',
    email_subject: 'Webinar de Ingresos Pasivos',
    share_title: 'Webinar de Ingresos Pasivos',
    share_text: 'Webinar de Ingresos Pasivos: cómo generar ingresos pasivos invirtiendo en bienes raíces comerciales, presentado por el desarrollador Bernardo Rieber. Véalo gratis:',

    plans_kicker: 'Planos y precios',
    form_t1: 'Reciba los planos',
    form_t2: 'y precios<span class="t-colon">.</span>',
    form_lede: 'Responda unas breves preguntas y le enviaremos los planos y los precios actuales de Vitalis Tower.',
    lock_title: 'Por favor, vea el video durante <span data-unlock-min>5</span>&nbsp;minutos para desbloquear el cuestionario.',
    lock_text: 'Se abrirá aquí automáticamente, sin necesidad de recargar la página.',
    lock_btn: 'Ver el webinar',
    lock_left: '{t} restantes',
    lock_unlocked: 'Desbloqueado',
    lock_status: 'El cuestionario está desbloqueado.',
    tf_title: 'Vitalis Tower – Planos y precios',

    sponsors: 'Patrocinadores',

    proj_kicker: 'Oficinas profesionales y locales comerciales en venta',
    proj_t1: 'Una inversión sólida',
    proj_t2: 'en el lugar indicado<span class="t-colon">.</span>',
    proj_lede: 'Una solución llave en mano para quienes buscan ingresos pasivos o desean ser dueños del lugar donde trabajan.',
    why: '¿Por qué Vitalis?',
    why1: 'Inquilinos sólidos',
    why2: 'Arrendamientos a largo plazo',
    why3: 'Contratos NNN',
    alt_hero: 'Exterior de Vitalis Tower de día — representación conceptual del artista',

    st1n: 'T1 2029',
    st1: 'Ocupación',
    st2n: '12 pies',
    st2: 'Altura de techos',
    st3n: '6.5 pies',
    st3: 'Pasillos amplios',
    st4: 'Seguridad del edificio',

    g1: 'Lobby con conserjería',
    g2: 'Oficinas totalmente terminadas',
    g3: 'Sala de conferencias multiusos',
    g4: 'Oficinas terminadas y apoyo en arrendamiento',
    g5: 'Alternativas gastronómicas',
    g6: 'Espacios de bienestar',
    alt_g1: 'Lobby con conserjería, un árbol interior y áreas de descanso — representación conceptual del artista',
    alt_g2: 'Oficina privada totalmente terminada con divisiones de vidrio — representación conceptual del artista',
    alt_g3: 'Sala de conferencias multiusos con pantalla de proyección — representación conceptual del artista',
    alt_g4: 'Médicos y una asesora de arrendamiento en la recepción de una oficina terminada — representación conceptual del artista',
    alt_g5: 'Café y área gastronómica en el edificio — representación conceptual del artista',
    alt_g6: 'Gimnasio y espacio de bienestar con ventanales de piso a techo — representación conceptual del artista',

    amen_h: 'Amenidades y servicios',
    a1: 'Seguridad del edificio 24/7',
    a2: 'Instalaciones dedicadas para conferencias y telemedicina',
    a3: 'Cómodas áreas de descanso en cada piso',
    a4: 'Restaurante de primera clase en el edificio',
    a5: 'Wi‑Fi gratuito en todas las áreas comunes',
    a6: 'Servicio de valet parking para visitantes',
    a7: 'Estaciones de carga para vehículos eléctricos (EV)',
    a8: 'Gimnasio e instalaciones para bicicletas',
    a9: 'Duchas y casilleros en el edificio',
    design_h: 'Diseño del edificio',
    d1: 'Techos de 12 pies de altura para un ambiente amplio y moderno',
    d2: 'Pasillos de 6.5 pies de ancho para el movimiento eficiente de pacientes y equipos',
    d3: 'Áreas techadas para dejar y recoger pacientes',
    d4: 'Entrada elevada al garaje para un acceso cómodo',
    team_h: 'Equipo',
    team1: 'Desarrollador',
    team2: 'Arquitectura y diseño',
    team3: 'Equipo de ventas',

    vt_title: 'Testimonios <span>de Clientes</span>',
    stars: '5 de 5 estrellas',

    alt_map: 'Vista aérea del Distrito Médico de Aventura con Vitalis Tower señalado',
    loc_kicker: 'Ubicación',
    loc_h: 'Distrito Médico de Aventura',
    loc_lede: 'Ubicado en Aventura, una de las comunidades más nuevas y deseadas de Miami: un destino de primer nivel para profesionales y especialistas en bienestar donde trabajar, conectar y crecer.',
    loc_near: 'A minutos de los principales puntos del distrito',

    cta_t1: 'Vea los planos',
    cta_t2: 'y los precios actuales<span class="t-colon">.</span>',
    cta_lede: 'Responda unas breves preguntas y reciba planos, precios y disponibilidad.',
    cta_btn: 'Obtener planos y precios',
    cta_note: 'Toma unos 30 segundos',

    /* ---- Registration page (/webinar/pro/) ---- */
    title_pro: 'Webinar de Ingresos Pasivos — Inversión en Bienes Raíces Comerciales | Vitalis Tower',
    desc_pro: 'Cómo generar ingresos pasivos invirtiendo en bienes raíces comerciales: un webinar gratuito y bajo demanda presentado por el desarrollador Bernardo Rieber. Regístrese y véalo al instante.',
    p_t1: 'Ingresos Pasivos',
    p_subhead: 'Cómo generar ingresos pasivos invirtiendo en bienes raíces comerciales',
    p_cta: 'Ver el webinar',
    p_cta_registered: 'Ver ahora',
    p_free: 'Gratis · Acceso inmediato',
    p_video_label: 'Vista previa del webinar',
    p_lock_label: 'Regístrese gratis para ver el webinar completo',
    p_lock_label_registered: 'Continuar al webinar completo',
    p_badge: '<i aria-hidden="true"></i>Vista previa · Sin sonido',
    p_lock_cta: 'Regístrese gratis para verlo',
    p_lock_cta_registered: 'Continuar al webinar',
    p_disc: 'Lo que veremos',
    p_disc1: 'Cómo una propiedad comercial genera ingresos pasivos',
    p_disc2: 'Inquilinos, arrendamientos y contratos triple neto (NNN)',
    p_disc3: 'Ser dueño de su oficina frente a alquilarla',
    p_disc4: 'El lugar de Vitalis Tower en Aventura',
    p_host_alt: 'Bernardo Rieber en el Sales Center de Vitalis Tower',
    p_host_kicker: 'Su presentador',
    p_role: 'Desarrollador inmobiliario',
    p_cred1: 'Ha construido y ahora desarrolla su tercer edificio, Vitalis Tower, en el Distrito Médico de Aventura',
    p_cred2: 'Desarrollos en el sur de Florida y Orlando',
    p_cred3: 'Reconocido recientemente por la Ciudad de Aventura por sus contribuciones al desarrollo',
    p_chip: 'Webinar completo',
    p_cap: '<strong>Bernardo Rieber</strong>Desarrollador inmobiliario',
    p_close: 'Cerrar',
    p_dlg_title: 'Desbloquee el webinar completo',
    p_dlg_sub: 'Regístrese una vez y empiece a verlo de inmediato.',
    p_first: 'Nombre',
    p_last: 'Apellido',
    p_email: 'Correo electrónico',
    p_phone: 'Teléfono móvil',
    p_err_first: 'Por favor, ingrese su nombre.',
    p_err_last: 'Por favor, ingrese su apellido.',
    p_err_email: 'Por favor, ingrese un correo electrónico válido.',
    p_err_phone: 'Por favor, ingrese un número de teléfono válido.',
    p_interest: 'Me interesa',
    p_int1: 'Invertir',
    p_int2: 'Mi propia oficina',
    p_int3: 'Ambos',
    p_consent: 'Envíenme el enlace por mensaje de texto. Pueden aplicarse tarifas de mensajes y datos; responda STOP para cancelar.',
    p_submit: 'Desbloquear el webinar',
    p_submit_busy: 'Desbloqueando…',
    p_submit_done: 'Desbloqueado',
    p_fine: 'También le enviaremos un enlace por correo para que pueda verlo cuando quiera.',
    p_err_unconfigured: 'El registro aún no está conectado. Inténtelo más tarde o contáctenos a través de vitalistower.com.',
    p_err_failed: 'No pudimos completar su registro. Revise su conexión e inténtelo de nuevo; sus datos siguen completados.',

    footer: '&copy; <span id="year"></span> Vitalis Tower. Las imágenes y los videos son ilustrativos; los detalles están sujetos a cambios. Esto no constituye una oferta de venta donde la ley lo prohíba.'
  };

  function normalize(v) {
    v = (v || '').toLowerCase();
    if (v.indexOf('es') === 0 || v.indexOf('sp') === 0) return 'es';
    if (v.indexOf('en') === 0) return 'en';
    return '';
  }
  var fromLink = normalize(new URLSearchParams(location.search).get('lang'));
  var saved = '';
  try { saved = normalize(localStorage.getItem(LANG_KEY)); } catch (e) {}
  var lang = fromLink || saved || 'en';
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}

  var DICT = lang === 'es' ? ES : null;
  function t(key, fallback) { return DICT && DICT[key] != null ? DICT[key] : fallback; }
  window.VITALIS_I18N = { lang: lang, t: t };

  document.documentElement.lang = lang;
  if (!DICT) return;

  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var v = DICT[el.getAttribute('data-i18n')];
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    var v = DICT[el.getAttribute('data-i18n-html')];
    if (v != null) el.innerHTML = v;
  });
  document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
    el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
      var i = pair.indexOf(':');
      if (i < 0) return;
      var v = DICT[pair.slice(i + 1).trim()];
      if (v != null) el.setAttribute(pair.slice(0, i).trim(), v);
    });
  });
})();
