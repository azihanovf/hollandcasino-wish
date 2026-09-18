(() => {
  'use strict';

  const DELIVERY_PENDING_TEXT =
    'Sending your request securely. The form processor will confirm acceptance on the next page.';
  const FILE_PROTOCOL_TEXT =
    'Online form delivery requires the hosted site. You can still use the email link below.';
  const GUEST_VALUES = new Set(['1', '2', '3', '4']);
  const ROOM_VALUES = new Set(['terrace', 'studio', 'residence', 'undecided']);
  const submitLabels = new WeakMap();

  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isRealDateString = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  };

  const getNextDateString = (value) => {
    if (!isRealDateString(value)) return '';

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 1);
    return getLocalDateString(date);
  };

  const initializeMenu = () => {
    document.querySelectorAll('details.site-menu').forEach((menu) => {
      const summary = menu.querySelector('summary');
      if (!summary) return;

      menu.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !menu.open) return;
        event.preventDefault();
        menu.open = false;
        summary.focus();
      });

      menu.querySelectorAll('nav a').forEach((link) => {
        link.addEventListener('click', () => {
          menu.open = false;
        });
      });
    });
  };

  const setDateError = (form, message) => {
    const error = form.querySelector('.date-error');
    if (error) error.textContent = message;
  };

  const validateDates = (form, showMessage = false) => {
    const arrival = form.elements.namedItem('arrival');
    const departure = form.elements.namedItem('departure');
    if (!(arrival instanceof HTMLInputElement) || !(departure instanceof HTMLInputElement)) {
      return true;
    }

    const today = getLocalDateString();
    const arrivalValue = arrival.value;
    const departureValue = departure.value;
    let message = '';

    arrival.setCustomValidity('');
    departure.setCustomValidity('');

    if (arrivalValue && (!isRealDateString(arrivalValue) || arrivalValue < today)) {
      message = 'Choose an arrival date of today or later.';
      arrival.setCustomValidity(message);
    } else if (
      departureValue &&
      (!isRealDateString(departureValue) || (arrivalValue && departureValue <= arrivalValue))
    ) {
      message = 'Choose a departure date after your arrival date.';
      departure.setCustomValidity(message);
    }

    setDateError(form, showMessage ? message : '');
    return message === '';
  };

  const initializeDateFields = (form) => {
    const arrival = form.elements.namedItem('arrival');
    const departure = form.elements.namedItem('departure');
    if (!(arrival instanceof HTMLInputElement) || !(departure instanceof HTMLInputElement)) {
      return;
    }

    const today = getLocalDateString();
    arrival.min = today;
    departure.min = getNextDateString(arrival.value) || today;

    const updateDates = (event) => {
      departure.min = getNextDateString(arrival.value) || today;
      validateDates(form, event.type === 'change');
    };

    arrival.addEventListener('input', updateDates);
    arrival.addEventListener('change', updateDates);
    departure.addEventListener('input', updateDates);
    departure.addEventListener('change', updateDates);
  };

  const isAllowedPlannerValue = (control, allowedValues) => {
    if (!(control instanceof HTMLSelectElement)) return true;
    return control.value === '' || allowedValues.has(control.value);
  };

  const initializePlanner = () => {
    document.querySelectorAll('form[data-planner]').forEach((form) => {
      initializeDateFields(form);

      form.addEventListener('submit', (event) => {
        const guests = form.elements.namedItem('guests');
        const room = form.elements.namedItem('room');
        const safeSelections =
          isAllowedPlannerValue(guests, GUEST_VALUES) &&
          isAllowedPlannerValue(room, ROOM_VALUES);
        const safeDates = validateDates(form, true);

        if (!safeSelections || !safeDates || !form.checkValidity()) {
          event.preventDefault();
          if (!safeSelections) {
            const status = form.querySelector('.form-status');
            if (status) status.textContent = 'Choose an available guest and room option.';
          }
          form.reportValidity();
        }
      });
    });
  };

  const setSafeControlValue = (form, name, value, allowedValues) => {
    const control = form.elements.namedItem(name);
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return;
    if (allowedValues.has(value)) control.value = value;
  };

  const prefillReservation = () => {
    const form = document.getElementById('reservation-form');
    if (!(form instanceof HTMLFormElement)) return;

    const params = new URLSearchParams(window.location.search);
    const arrival = params.get('arrival') || '';
    const departure = params.get('departure') || '';

    if (isRealDateString(arrival)) {
      setSafeControlValue(form, 'arrival', arrival, new Set([arrival]));
    }
    if (isRealDateString(departure)) {
      setSafeControlValue(form, 'departure', departure, new Set([departure]));
    }
    setSafeControlValue(form, 'guests', params.get('guests') || '', GUEST_VALUES);
    setSafeControlValue(form, 'room', params.get('room') || '', ROOM_VALUES);

    const arrivalControl = form.elements.namedItem('arrival');
    const departureControl = form.elements.namedItem('departure');
    if (arrivalControl instanceof HTMLInputElement && departureControl instanceof HTMLInputElement) {
      departureControl.min = getNextDateString(arrivalControl.value) || getLocalDateString();
    }
  };

  const setDeliveryControlsDisabled = (form, disabled) => {
    form.querySelectorAll('button[type="submit"], input[type="submit"]').forEach((control) => {
      if (!submitLabels.has(control)) {
        submitLabels.set(
          control,
          control instanceof HTMLInputElement ? control.value : control.textContent
        );
      }

      control.disabled = disabled;
      if (control instanceof HTMLInputElement) {
        control.value = disabled ? 'Sending…' : submitLabels.get(control);
      } else {
        control.textContent = disabled ? 'Sending…' : submitLabels.get(control);
      }
    });
  };

  const resetDeliveryState = () => {
    document.querySelectorAll('form[data-delivery]').forEach((form) => {
      setDeliveryControlsDisabled(form, false);
      const status = form.querySelector('.form-status');
      if (status) {
        status.textContent = window.location.protocol === 'file:' ? FILE_PROTOCOL_TEXT : '';
      }
    });
  };

  const initializeDeliveryForms = () => {
    document.querySelectorAll('form[data-delivery]').forEach((form) => {
      initializeDateFields(form);

      const status = form.querySelector('.form-status');
      if (status && window.location.protocol === 'file:') {
        status.textContent = FILE_PROTOCOL_TEXT;
      }

      form.addEventListener('submit', (event) => {
        const validDates = validateDates(form, true);
        if (!validDates || !form.checkValidity()) {
          event.preventDefault();
          form.reportValidity();
          return;
        }

        if (status) status.textContent = DELIVERY_PENDING_TEXT;
        setDeliveryControlsDisabled(form, true);
      });
    });

    window.addEventListener('pageshow', resetDeliveryState);
  };

  const getSafeGalleryUrl = (link) => {
    const href = link.getAttribute('href') || '';
    if (
      !/^assets\/images\/[a-z0-9][a-z0-9._-]*\.webp$/i.test(href) ||
      href.includes('..') ||
      href.includes('\\')
    ) {
      return null;
    }

    try {
      return new URL(href, document.baseURI);
    } catch {
      return null;
    }
  };

  const initializeGallery = () => {
    const dialog = document.getElementById('gallery-dialog');
    const dialogImage = document.getElementById('gallery-image');
    const caption = document.getElementById('gallery-caption');
    if (
      typeof window.HTMLDialogElement === 'undefined' ||
      !(dialog instanceof HTMLDialogElement) ||
      !(dialogImage instanceof HTMLImageElement) ||
      !(caption instanceof HTMLElement) ||
      typeof dialog.showModal !== 'function'
    ) {
      return;
    }

    const closeButton = dialog.querySelector('button[data-close-dialog]');
    let returnFocus = null;

    document.querySelectorAll('a[data-gallery]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const imageUrl = getSafeGalleryUrl(link);
        if (!imageUrl) return;

        const thumbnail = link.querySelector('img');
        event.preventDefault();
        returnFocus = link;
        dialogImage.src = imageUrl.href;
        dialogImage.alt = thumbnail?.alt || '';
        caption.textContent = link.dataset.caption || thumbnail?.alt || '';
        dialog.showModal();
      });
    });

    closeButton?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialogImage.removeAttribute('src');
      if (returnFocus instanceof HTMLElement) returnFocus.focus();
      returnFocus = null;
    });
  };

  initializeMenu();
  prefillReservation();
  initializePlanner();
  initializeDeliveryForms();
  initializeGallery();
})();
