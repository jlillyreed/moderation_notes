/**
 * @file
 * Contains all Moderation Notes behaviors.
 */

(function ($, Drupal) {

  "use strict";

  Drupal.moderation_notes = {
    selection: {
      quote: false,
      quote_offset: false,
      field_id: false
    }
  };

  var $add_tooltip = initializeAddTooltip();
  var $view_tooltip = initializeViewTooltip();
  var view_tooltip_timeout;

  /**
   * Command to remove a Moderation Note.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The ajax object.
   * @param {Object} response
   *   Object holding the server response.
   * @param {String} response.id
   *   The ID for the moderation note.
   * @param {Number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.remove_moderation_note = function (ajax, response, status) {
    var id = response.id;
    var $wrapper = $('[data-moderation-note-id="' + id + '"]');
    $wrapper.contents().unwrap();
    $('#drupal-offcanvas').dialog().dialog('close');
  };

  /**
   * Command to add a Moderation Note.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The ajax object.
   * @param {Object} response
   *   Object holding the server response.
   * @param {Object} response.note
   *   An object representing a moderation note.
   * @param {Number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.add_moderation_note = function (ajax, response, status) {
    var note = response.note;
    showModerationNote(note);
    $('#drupal-offcanvas').dialog().dialog('close');
  };

  /**
   * Command to show a Moderation Note in the sidebar.
   *
   * @param {Drupal.Ajax} [ajax]
   *   The ajax object.
   * @param {Object} response
   *   Object holding the server response.
   * @param {Number} response.id
   *   The ID for the moderation note.
   * @param {Number} [status]
   *   The HTTP status code.
   */
  Drupal.AjaxCommands.prototype.show_moderation_note = function (ajax, response, status) {
    $('#drupal-offcanvas').fadeOut('fast');
    var note_id = response.id;
    var view_ajax = new Drupal.ajax({
        url: Drupal.formatString(Drupal.url('moderation-note/!id'), {'!id': note_id}),
        dialogType: 'dialog_offcanvas',
        progress: {type: 'fullscreen'}
    });
    view_ajax.execute();
  };

  /**
   * Builds a URL based on a given field ID.
   *
   * Identical to Drupal.quickedit.utils.buildUrl.
   *
   * @param {Number} id
   *   A field ID, as provied by moderation_notes_preprocess_field().
   * @param {String} urlFormat
   *   A string with placeholders matching field ID parts.
   * @returns {String}
   *  The built URL.
   */
  function buildUrl (id, urlFormat) {
    var parts = id.split('/');
    return Drupal.formatString(decodeURIComponent(urlFormat), {
      '!entity_type': parts[0],
      '!id': parts[1],
      '!field_name': parts[2],
      '!langcode': parts[3],
      '!view_mode': parts[4]
    });
  }

  /**
   * Performs a text search within the page based on a given string.
   *
   * Modified from http://stackoverflow.com/a/5887719, written by @tpdown.
   *
   * @param {String} text
   *   The string to search for. Should not contain HTML.
   * @param {Node} element
   *   The parent element to perform the search within. Defaults to body.
   * @param {Number} offset
   *   The text offset from the start of the element to start the search.
   * @returns {Boolean}
   *   The status of the search. Use window.getSelection() to access the Range.
   */
  function doSearch (text, element, offset) {
    element = element || document.body;
    offset = offset || 0;
    var match = false;

    if (window.find && window.getSelection) {
      var selection = window.getSelection();
      selection.collapse(element, 0);

      var offset_difference = element.innerHTML.length;
      while (window.find(text)) {
        var range = selection.getRangeAt(0);
        var $ancestor = $(range.commonAncestorContainer);
        if ($ancestor.closest(element).length) {
          var current_offset = getCursorPositionInTextOf(element, range);
          var current_difference = Math.abs(current_offset - offset);
          if (current_difference < offset_difference) {
            offset_difference = current_difference;
            match = range;
          }
        }
        else {
          break;
        }
        selection.collapseToEnd();
      }
    }

    selection.collapseToEnd();
    return match;
  }

  /**
   * Finds the offset of a range relative to a given parent element.
   *
   * Modified from http://stackoverflow.com/a/11358084, written by benjamin-rögner.
   *
   * @param {Node} element
   *   The element to compare against. Defaults to body.
   * @param {Range} range
   *   The range that requires comparison.
   * @returns {Number}
   *   The offset of the range.
   */
  function getCursorPositionInTextOf (element, range) {
    element = element || document.body;
    var parent_range = document.createRange();
    parent_range.setStart(element, 0);
    parent_range.setEnd(range.startContainer, range.startOffset);
    // Measure the length of the text from the start of the given element to
    // the start of the current range (position of the cursor).
    return parent_range.cloneContents().textContent.length;
  }

  /**
   * Initializes the tooltip used to add new notes.
   *
   * @returns {Object}
   *   The tooltip.
   */
  function initializeAddTooltip () {
    var $tooltip = $('<a class="moderation-notes-tooltip add" href="javascript:;">' + Drupal.t('Add note') + '</a>').hide();

    // Click callback.
    $tooltip.on('click', function () {
      var field_id = Drupal.moderation_notes.selection.field_id;
      var form_ajax = new Drupal.ajax({
        url: buildUrl(field_id, Drupal.url('moderation-notes/add/!entity_type/!id/!field_name/!langcode/!view_mode')),
        dialogType: 'dialog_offcanvas',
        progress: {type: 'fullscreen'}
      });
      form_ajax.execute();
    });

    $('body').append($tooltip);

    return $tooltip;
  }

  /**
   * Initializes the tooltip used to view existing notes.
   *
   * @returns {Object}
   *   The tooltip.
   */
  function initializeViewTooltip () {
    var $tooltip = $('<a class="moderation-notes-tooltip view" href="javascript:;">' + Drupal.t('View note') + '</a>').hide();

    // Click callback.
    $tooltip.on('click', function () {
      var note = $(this).data('moderation-note');
      $(this).fadeOut('fast');
      var view_ajax = new Drupal.ajax({
        url: Drupal.formatString(Drupal.url('moderation-note/!id'), {'!id': note.id}),
        dialogType: 'dialog_offcanvas',
        progress: {type: 'fullscreen'}
      });
      view_ajax.execute();
    });

    $('body').append($tooltip);

    $tooltip.on('mouseleave', function () {
      view_tooltip_timeout = setTimeout(function () {
        $tooltip.fadeOut('fast');
      }, 500);
    });

    $tooltip.on('mouseover', function () {
      clearTimeout(view_tooltip_timeout);
    });

    return $tooltip;
  }

  /**
   * Displays the tooltip at a position relative to the current Range.
   *
   * @param {Object} $tooltip
   *   The tooltip.
   */
  function showAddTooltip ($tooltip) {
    var range = window.getSelection().getRangeAt(0);
    var rect = range.getBoundingClientRect();
    var width_offset = (rect.width / 2) - ($tooltip.outerWidth() / 2);
    $tooltip.css('left', rect.left + document.body.scrollLeft + width_offset);
    $tooltip.css('top', rect.top + document.body.scrollTop - ($tooltip.outerHeight() + 5));
    $tooltip.fadeIn('fast');
  }

  /**
   * Displays the tooltip at a position relative to the given element.
   *
   * @param {Object} $tooltip
   *   The tooltip.
   * @param {Object} $element
   *   The element to display to tooltip on.
   */
  function showViewTooltip ($tooltip, $element) {
    var width_offset = ($element.outerWidth() / 2) - ($tooltip.outerWidth() / 2);
    var offset = $element.offset();
    $tooltip.css('left', offset.left + width_offset);
    $tooltip.css('top', offset.top - ($tooltip.outerHeight() + 5));
    $tooltip.fadeIn('fast');
  }

  /**
   * Shows the given moderation note as a highlighted range.
   *
   * @param {Object} note
   *   An objects representing a Moderation Note.
   */
  function showModerationNote (note) {
    var $field = $('[data-moderation-notes-field-id="' + note.field_id + '"]');
    if ($field.length) {
      var match = doSearch(note.quote, $field[0], note.quote_offset);
      if (match) {
        var wrap = document.createElement('span');
        wrap.classList = 'moderation-note-highlight';
        wrap.appendChild(match.extractContents());
        match.insertNode(wrap);

        // Attach behaviors for the note.
        var $wrap = $(wrap);
        $wrap.data('moderation-note', note);
        // This allows notes to be found by their ID.
        $wrap.attr('data-moderation-note-id', note.id);

        $wrap.on('mouseover', function () {
          showViewTooltip($view_tooltip, $(this));
          $view_tooltip.data('moderation-note', $(this).data('moderation-note'));
          clearTimeout(view_tooltip_timeout);
        });

        $wrap.on('mouseleave', function () {
          view_tooltip_timeout = setTimeout(function () {
            $view_tooltip.fadeOut('fast');
          }, 500);
        });
      }
    }
  }

  /**
   * Highlights focused text while the sidebar is open.
   *
   * @param {Object} note
   *   An objects representing a Moderation Note.
   */
  function showContextHighlight (note) {
    // Remove all existing contextual highlights.
    $('.moderation-note-contextual-highlight').each(function () {
      if ($(this).data('moderation-note-id')) {
        $(this).removeClass('moderation-note-contextual-highlight existing');
      }
      else {
        $(this).contents().unwrap();
      }
    });

    var $note = $('[data-moderation-note-id="' + note.id + '"]');
    // If this note is already highlighted, simply add a class.
    if ($note.length) {
      $note.addClass('moderation-note-contextual-highlight existing');
      $(document).on('dialogclose', function () {
        $note.removeClass('moderation-note-contextual-highlight existing');
      });
    }
    // Otherwise, we need to create a new highlight.
    else {
      var $field = $('[data-moderation-notes-field-id="' + note.field_id + '"]');
      var match = doSearch(note.quote, $field[0], note.quote_offset);
      if (match) {
        var wrap = document.createElement('span');
        wrap.classList = 'moderation-note-contextual-highlight new';
        wrap.appendChild(match.extractContents());
        match.insertNode(wrap);

        $(document).on('dialogclose', function () {
          $(wrap).contents().unwrap();
        });
      }
    }
  }

  // We use timeouts to throttle calls to this event.
  var timeout;
  $(document).on('selectionchange', function () {
    clearTimeout(timeout);
    $add_tooltip.fadeOut('fast');

    timeout = setTimeout(function () {
      if (window.getSelection) {
        var selection = window.getSelection();
        var text = selection.toString();
        if (text.length) {
          // Ensure that this selection is contained inside a field wrapper.
          var range = selection.getRangeAt(0);
          var $ancestor = $(range.commonAncestorContainer);
          var $field = $ancestor.closest('[data-moderation-notes-field-id]');
          if ($field.length) {
            // Show the tooltip.
            showAddTooltip($add_tooltip);

            // Store the current selection so that it can be added to the form
            // later.
            var offset = getCursorPositionInTextOf($field[0], range);
            Drupal.moderation_notes.selection.quote = text;
            Drupal.moderation_notes.selection.quote_offset = offset;
            Drupal.moderation_notes.selection.field_id = $field.data('moderation-notes-field-id');
          }
        }
      }
    }, 500);
  });

  /**
   * Contains all Moderation Notes behaviors.
   *
   * @type {Drupal~behavior}
   */
  Drupal.behaviors.moderation_notes = {
    attach: function (context, settings) {
      var $new_form = $('[data-moderation-notes-new-form]', context);
      if ($new_form.length) {
        var selection = Drupal.moderation_notes.selection;
        $new_form.find('input[name="quote"]').val(selection.quote);
        $new_form.find('input[name="quote_offset"]').val(selection.quote_offset);
        showContextHighlight(selection);
      }

      // Allow forms to highlight contextual notes while open.
      // We can't do this in a AJAX command as (afaik), you can't return an
      // arbitrary AJAX command with a normal render array.
      if (settings.highlight_moderation_note) {
        showContextHighlight(settings.highlight_moderation_note);
        delete settings.highlight_moderation_note;
      }

      // On page load, display all note given to us.
      if (settings.moderation_notes) {
        var notes = settings.moderation_notes;
        delete settings.moderation_notes;
        for (var i in notes) {
          var note = notes[i];
          showModerationNote(note);
        }
        $('#drupal-offcanvas').dialog().dialog('close');
      }
    }
  }

}(jQuery, Drupal));
