(function () {
  'use strict';

  var widget = document.querySelector('.engagement-map-widget');
  if (!widget) return;

  var canvas = widget.querySelector('.engagement-map-canvas');
  var panel = widget.querySelector('.engagement-map-panel');
  var panelBody = widget.querySelector('.engagement-map-panel-body');
  var overviewBtn = widget.querySelector('.engagement-map-overview-btn');
  var tooltip = widget.querySelector('.engagement-map-tooltip');
  var svgRoot = null;
  var countryByCode = {};
  var overviewCopy = null;
  var citationReachCount = null;
  var selectedCode = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var DISPLAY_ALIASES = { TW: 'CN' };

  var assetBase = widget.getAttribute('data-asset-base') || '/engagement/';

  function assetUrl(filename) {
    var normalizedBase = assetBase.endsWith('/') ? assetBase : assetBase + '/';
    return normalizedBase + filename.replace(/^\/+/, '');
  }

  function displayCode(code) {
    return DISPLAY_ALIASES[code] || code;
  }

  function mapElementCodes(code) {
    var resolved = displayCode(code);
    var codes = [resolved];
    Object.keys(DISPLAY_ALIASES).forEach(function (alias) {
      if (DISPLAY_ALIASES[alias] === resolved) codes.push(alias);
    });
    return codes.filter(function (value, index, list) {
      return list.indexOf(value) === index;
    });
  }

  function countryElement(code) {
    if (!svgRoot) return null;
    return svgRoot.querySelector('#' + CSS.escape(code.toLowerCase()));
  }

  function forMapElements(code, callback) {
    mapElementCodes(code).forEach(function (mapCode) {
      var el = countryElement(mapCode);
      if (el) callback(el, mapCode);
    });
  }

  function tooltipSummary(country) {
    var parts = [];
    if (country.has_direct_connection) parts.push('direct research connections');
    if (country.citing_count) parts.push('citation reach');
    return country.name + ' — ' + parts.join(' and ');
  }

  function buildAriaLabel(country) {
    return tooltipSummary(country) + '. Press Enter or Space to view details.';
  }

  function clearSelectionStyles() {
    widget.querySelectorAll('.engagement-country.is-selected, .engagement-country.is-hovered').forEach(function (el) {
      el.classList.remove('is-selected', 'is-hovered');
    });
  }

  function overviewSecondaryHtml() {
    return 'Authors of publications citing my work are affiliated with institutions across <strong>' + citationReachCount +
      ' countries and regions</strong>.';
  }

  function citationReachSentence(country) {
    var count = country.citing_count;
    var noun = count === 1 ? 'publication' : 'publications';
    return count + ' external citing ' + noun + ' with ' + country.name + '-based affiliations.';
  }

  function overviewActionHtml() {
    var hint = overviewCopy.interaction_hint || overviewCopy.interaction_instruction || '';
    return '<div class="engagement-map-overview-action">' +
      '<p class="engagement-map-overview-hint">' + hint + '</p>' +
      '</div>';
  }

  function setOverviewPanelState(isOverview) {
    if (!panelBody) return;
    if (isOverview) panelBody.classList.add('is-overview-state');
    else panelBody.classList.remove('is-overview-state');
  }

  function showOverview() {
    selectedCode = null;
    clearSelectionStyles();
    overviewBtn.hidden = true;
    if (!overviewCopy || !panelBody) return;
    panelBody.innerHTML =
      '<p class="engagement-map-overview-lead">' + overviewCopy.default_text + '</p>' +
      '<p class="engagement-map-overview-secondary">' + overviewSecondaryHtml() + '</p>' +
      overviewActionHtml();
    panel.setAttribute('aria-label', 'Map overview');
    setOverviewPanelState(true);
  }

  function renderCountryDetail(country) {
    var html = '<h3 class="engagement-map-panel-title">' + country.name + '</h3>';

    if (country.has_direct_connection) {
      html += '<div class="engagement-map-panel-section">';
      html += '<h4 class="engagement-map-panel-heading">Direct research activities</h4>';
      if (country.connection_types && country.connection_types.length) {
        html += '<ul class="engagement-map-panel-types">';
        country.connection_types.forEach(function (type) {
          html += '<li>' + type + '</li>';
        });
        html += '</ul>';
      }
      html += '</div>';

      if (country.related_institutions && country.related_institutions.length) {
        html += '<div class="engagement-map-panel-section">';
        html += '<h4 class="engagement-map-panel-heading">Related institutions</h4>';
        html += '<ul class="engagement-map-panel-related">';
        country.related_institutions.forEach(function (institution) {
          html += '<li>' + institution + '</li>';
        });
        html += '</ul>';
        html += '</div>';
      }

      if (country.connection_details && country.connection_details.length) {
        html += '<div class="engagement-map-panel-section">';
        html += '<h4 class="engagement-map-panel-heading">Details</h4>';
        html += '<ul class="engagement-map-panel-details">';
        country.connection_details.forEach(function (detail) {
          html += '<li>' + detail + '</li>';
        });
        html += '</ul>';
        html += '</div>';
      }
    }

    if (country.citing_count) {
      html += '<div class="engagement-map-panel-section">';
      html += '<h4 class="engagement-map-panel-heading">Citation reach</h4>';
      html += '<p class="engagement-map-panel-reach">' + citationReachSentence(country) + '</p>';
      html += '</div>';
    }

    panelBody.innerHTML = html;
    panel.setAttribute('aria-label', country.name + ' details');
    overviewBtn.hidden = false;
    setOverviewPanelState(false);
  }

  function selectCountry(mapCode) {
    var code = displayCode(mapCode);
    var country = countryByCode[code];
    if (!country) return;
    selectedCode = code;
    clearSelectionStyles();
    forMapElements(code, function (el) {
      el.classList.add('is-selected');
    });
    var activeEl = countryElement(mapCode);
    if (activeEl && document.activeElement !== activeEl) {
      activeEl.focus({ preventScroll: true });
    }
    renderCountryDetail(country);
    hideTooltip();
  }

  function highlightCountry(mapCode, hovered) {
    var code = displayCode(mapCode);
    if (selectedCode === code) return;
    forMapElements(code, function (el) {
      if (hovered) el.classList.add('is-hovered');
      else el.classList.remove('is-hovered');
    });
  }

  function showTooltip(event, country) {
    if (!tooltip || window.matchMedia('(hover: none)').matches) return;
    tooltip.textContent = tooltipSummary(country);
    tooltip.hidden = false;
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip || tooltip.hidden) return;
    var offset = 12;
    var x = event.clientX + offset;
    var y = event.clientY + offset;
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';

    var rect = tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      tooltip.style.left = Math.max(8, event.clientX - rect.width - offset) + 'px';
    }
    if (rect.bottom > window.innerHeight - 8) {
      tooltip.style.top = Math.max(8, event.clientY - rect.height - offset) + 'px';
    }
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.hidden = true;
  }

  function onCountryKeydown(event, mapCode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectCountry(mapCode);
    }
  }

  function bindMapElement(mapCode, displayCountry) {
    var el = countryElement(mapCode);
    if (!el) return;

    el.classList.add('engagement-country');
    if (displayCountry.citing_count) el.classList.add('engagement-has-citation');
    if (displayCountry.has_direct_connection) el.classList.add('engagement-has-direct');

    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', buildAriaLabel(displayCountry));

    el.addEventListener('click', function () {
      selectCountry(mapCode);
    });
    el.addEventListener('keydown', function (event) {
      onCountryKeydown(event, mapCode);
    });
    el.addEventListener('mouseenter', function (event) {
      highlightCountry(mapCode, true);
      showTooltip(event, displayCountry);
    });
    el.addEventListener('mouseleave', function () {
      highlightCountry(mapCode, false);
      hideTooltip();
    });
    el.addEventListener('mousemove', moveTooltip);
    el.addEventListener('focus', function () {
      highlightCountry(mapCode, true);
    });
    el.addEventListener('blur', function () {
      highlightCountry(mapCode, false);
    });
  }

  function enhanceSvg() {
    var nativeTitle = svgRoot.querySelector(':scope > title');
    if (nativeTitle) nativeTitle.remove();

    svgRoot.removeAttribute('title');
    svgRoot.setAttribute(
      'aria-label',
      'Interactive world map of research connections and citation reach'
    );
    svgRoot.setAttribute('focusable', 'false');
    svgRoot.setAttribute('aria-hidden', 'false');
    svgRoot.classList.add('engagement-map-svg');

    Object.keys(countryByCode).forEach(function (code) {
      bindMapElement(code, countryByCode[code]);
    });

    Object.keys(DISPLAY_ALIASES).forEach(function (alias) {
      var display = countryByCode[DISPLAY_ALIASES[alias]];
      if (display) bindMapElement(alias, display);
    });
  }

  function onDocumentKeydown(event) {
    if (event.key === 'Escape' && selectedCode) {
      event.preventDefault();
      showOverview();
      canvas.focus({ preventScroll: true });
    }
  }

  function init() {
    Promise.all([
      fetch(assetUrl('map-data.json')).then(function (response) {
        if (!response.ok) throw new Error('Failed to load map-data.json (' + response.status + ')');
        return response.json();
      }),
      fetch(assetUrl('world-map.svg')).then(function (response) {
        if (!response.ok) throw new Error('Failed to load world-map.svg (' + response.status + ')');
        return response.text();
      })
    ])
      .then(function (results) {
        var data = results[0];
        var svgText = results[1];
        overviewCopy = data.overview;
        citationReachCount = data.citation_reach_country_count;

        data.countries.forEach(function (country) {
          countryByCode[country.code] = country;
        });

        canvas.innerHTML = svgText;
        svgRoot = canvas.querySelector('svg');
        if (!svgRoot) throw new Error('SVG root element not found');

        enhanceSvg();
        showOverview();

        overviewBtn.addEventListener('click', showOverview);
        document.addEventListener('keydown', onDocumentKeydown);

        widget.classList.add('engagement-map-ready');
        if (reducedMotion) widget.classList.add('engagement-map-reduced-motion');
      })
      .catch(function (err) {
        console.error('Engagement map failed to load:', err);
        widget.classList.add('engagement-map-error');
        if (canvas && !canvas.querySelector('.engagement-map-load-note')) {
          var note = document.createElement('p');
          note.className = 'engagement-map-load-note';
          note.textContent = 'Map unavailable.';
          canvas.appendChild(note);
        }
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
