/**
* WatCal
* Jay Ching Lim
*/
'use strict';

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }
  return s4() + '-' + s4() + '-' + s4() + '-' + s4();
}

function getLocale() {
  return navigator.languages != undefined ? navigator.languages[0] : navigator.language
}

var OpenDataAPI = (function() {
  var API_KEY = '0344dcbf63c56d35fbac1ffd60ecf116';
  var API_BASE_URL = 'https://api.uwaterloo.ca/v2';
  var cache = {};

  // GET /terms/list.{format}
  var getTermsListings = function(callback) {
    var endpoint = API_BASE_URL + '/terms/list.json';
    if (cache[endpoint] !== undefined) {
      callback(cache[endpoint]);
      return;
    }

    $.getJSON(endpoint, { key: API_KEY }).done(function(response) {
      if (response.meta.status != 200) { // request unsuccessful
        console.log('[WatCal] Error: ' + response.meta.status.message);
        return;
      }
      cache[endpoint] = response;
      callback(response);
    });
  };

  // GET /terms/{term}/{subject}/{catalog_number}/schedule.{format}
  var getCourseScheduleByTerm = function(term, subject, catalog_number, callback) {
    var endpoint = API_BASE_URL + '/terms/' + term + '/' + subject + '/' + catalog_number + '/schedule.json';
    if (cache[endpoint] !== undefined) {
      callback(cache[endpoint]);
      return;
    }

    $.getJSON(endpoint, { key: API_KEY }).done(function(response) {
      if (response.meta.status != 200) { // request unsuccessful
        console.log('[WatCal] Error: ' + response.meta.status.message);
        return;
      }
      cache[endpoint] = response;
      callback(response);
    });
  };

  var getStartEndDate = function(term) {
    // TODO:
    // 1. Implement using important dates API
    // 2. Change this to asynchronous
    switch (term) {
      case 1169: // Fall 2016
        return '2016-09-08 - 2016-12-05';
      case 1171: // Winter 2017
        return '2017-01-03 - 2017-04-03';
      case 1175: // Spring 2017
        return '2017-05-01 - 2017-07-25';
    }
    return null;
  };

  return {
    getTermsListings: getTermsListings,
    getCourseScheduleByTerm: getCourseScheduleByTerm,
    getStartEndDate: getStartEndDate
  };
}());

var LoadingIcon = (function() {
  var show = function() {
    $('#WAIT_win0').css({ 'visibility': 'visible', 'display': 'block' });
  };

  var hide = function() {
    $('#WAIT_win0').css({ 'visibility': 'hidden', 'display': 'none' });
  };

  return {
    show: show,
    hide: hide
  };
}());

var DownloadLink = (function() {
  var reset = function() {
    if ($('#DSCHEDULE') === null) { // first time
      return;
    }
    $('#DSCHEDULE a').unbind('click');
    $('#DSCHEDULE').remove();
  }

  var show = function(type, message) {
    // everytime when we show, we reset
    reset();
    LoadingIcon.hide();
    if (type === 'generating') {
      LoadingIcon.show();
      $('#UW_DERIVED_CEM2_DESCR_X2').append('<div id="DSCHEDULE"> <a href="#" style="color:rgb(74,89,140)">(Generating Schedule...)</a></div>');
      $('#DSCHEDULE a').click(function(e) {
        e.preventDefault();
        alert('Please wait for a moment.');
      });
    } else if (type === 'error') {
      $('#UW_DERIVED_CEM2_DESCR_X2').append('<div id="DSCHEDULE"> <a href="#" style="color:red">(Invalid Schedule)</a>)</div>');
      $('#DSCHEDULE a').click(function(e) {
        e.preventDefault();
        alert('Unable to create a schedule. ' + message);
      });
    } else if (type === 'success') {
      var studentName = $('#DERIVED_SSTSNAV_PERSON_NAME').text().toLowerCase();
      studentName = studentName.replace(/\ /g, '-');  // Replace spaces with dashes
      var fileName = studentName + '-uw-class-schedule.ics';

      $('#UW_DERIVED_CEM2_DESCR_X2').append(
        ' <a href="data:text/calendar;charset=UTF-8,' + encodeURIComponent(message) + '" download="' + fileName + '" style="color:#ab5b1a">(Download Schedule)</a>'
      );
    }
  }

  return {
    show: show,
    reset: reset
  };
}());

var Calendar = (function() {
  var TIMEZONE = 'America/Toronto';
  var event = new EventEmitter();

  var content = '';
  var sections_count = undefined;
  var current_count = 0;

  event.on('count_section', function() {
    current_count++;
    if (current_count == sections_count) { // everything is loaded, display download link
      DownloadLink.show('success', _getContent());
    }
  });

  var init = function(count) {
    sections_count = count;
    if (sections_count == 0) {
      DownloadLink.show('error', 'No sections found.');
    }
  };

  var _getDaysOfWeek = function(days) {
    days = days.replace(/([A-Z])/g, ' $1').substring(1).split(' ');

    var formattedDays = [];

    days.forEach(function(day) {
      if (day == 'Su') {
        formattedDays.push('SU');
      }
      if (day == 'M') {
        formattedDays.push('MO');
      }
      if (day == 'T') {
        formattedDays.push('TU');
      }
      if (day == 'W') {
        formattedDays.push('WE');
      }
      if (day == 'Th') {
        formattedDays.push('TH');
      }
      if (day == 'F') {
        formattedDays.push('FR');
      }
      if (day == 'S' || day == 'Sa') {
        formattedDays.push('SA');
      }
    });

    return formattedDays.join(',');
  };

  var addSection = function(section) {
    if (sections_count === undefined) {
      // console.log('[WatCal] Initialize the calendar first.');
      return;
    }

    var courseCode = section.subject + ' ' + section.catalog_number;
    var section_string = section.section.split(' ');
    var component = section_string[0];
    //if (component == 'TST') {
    //  return; // skip this one
    //}

    section.classes.forEach(function(klass) {
      var room = klass.location == undefined ? 'TBA' : klass.location.building + ' ' + klass.location.room;
      var daysOfWeek = _getDaysOfWeek(klass.date.weekdays);
      var instructor = klass.instructors.length == 0 ? 'TBA' : klass.instructors[0].replace(/([a-zA-Z]+),([a-zA-Z]+)/, '$2 $1');

      var startEndDate = OpenDataAPI.getStartEndDate(section.term); // YYYY-MM-DD
      if (startEndDate == null) { // cannot find start/end date
        DownloadLink.show('error', 'StartEndDate not found.');
        return;
      }

      // for tests
      // start_date and end_date are not null
      if (klass.date.start_date !== null && klass.date.end_date !== null) {
        var year = parseInt((section.term / 10) % 100);

        var split_start = klass.date.start_date.split("/");
        var start_date = "20" + year + "-" + split_start[0] + "-" + split_start[1];

        var split_end = klass.date.end_date.split("/");
        var end_date = "20" + year + "-" + split_end[0] + "-" + split_end[1];

        startEndDate = start_date + " - " + end_date;
      }

      // Start the event one day before the actual start date, then exclude it in an exception date
      // rule. This ensures an event does not occur on startDate if startDate is not on part of daysOfWeek.
      var start_time = klass.date.start_time.split(':');
      var startDate = moment(startEndDate.substring(0, 10), 'YYYY-MM-DD').subtract(1, 'day');

      // End the event one day after the actual end date. Technically, the RRULE UNTIL field should
      // be the start time of the last occurrence of an event. However, since the field does not
      // accept a timezone (only UTC time) and Toronto is always behind UTC, we can just set the
      // end date one day after and be guaranteed that no other occurrence of this event.
      var end_time = klass.date.end_time.split(':');
      var endDate = moment(startEndDate.substring(13, 23), 'YYYY-MM-DD').add(1, 'day');

      // DTSTAMP doesn't matter
      var iCalContent =
        'BEGIN:VEVENT\r\n' +
        'DTSTART;TZID=' + TIMEZONE + ':' + startDate.set({ 'hour': start_time[0], 'minute': start_time[1] }).format('YYYYMMDDTHHmmss') + '\r\n' +
        'DTEND;TZID=' + TIMEZONE + ':' + startDate.set({ 'hour': end_time[0], 'minute': end_time[1] }).format('YYYYMMDDTHHmmss') + '\r\n' +
        'DTSTAMP:' + moment(new Date().toISOString()).format('YYYYMMDDTHHmmss') + '\r\n' +
        'LOCATION:' + room + '\r\n' +
        'RRULE:FREQ=WEEKLY;UNTIL=' + endDate.set({ 'hour': end_time[0], 'minute': end_time[1] }).format('YYYYMMDDTHHmmss') + 'Z;BYDAY=' + daysOfWeek + '\r\n' +
        'EXDATE;TZID=' + TIMEZONE + ':' + startDate.set({ 'hour': start_time[0], 'minute': start_time[1] }).format('YYYYMMDDTHHmmss') + '\r\n' +
        'SUMMARY:' + courseCode + ' (' + component + ') in ' + room + '\r\n' +
        'DESCRIPTION:' +
          'Course Title: ' + section.title + '\\n' +
          'Section: ' + section_string[1] + '\\n' +
          'Instructor: ' + instructor + '\\n' +
          'Class Number: ' + section.class_number + '\\n' +
          'Start/End Date: ' + startEndDate + '\\n\r\n' +
        'UID:' + guid() + '\r\n' +
        'END:VEVENT\r\n';

      content += iCalContent;
      event.trigger('count_section');
    });
  };

  var addInvalidSection = function(course) {
    if (sections_count === undefined) {
      // console.log('[WatCal] Initialize the calendar first.');
      return;
    }
    // console.log('Section ' + course['section'] + ' for ' + course['subject'] + '' + course['catalog_number'] + ' not found.');
    event.trigger('count_section');
  };

  var _getContent = function() {
    return (
      'BEGIN:VCALENDAR\r\n' +
      'VERSION:2.0\r\n' +
      'PRODID:-//Jay Ching Lim/WatCal//EN\r\n' +
      'BEGIN:VTIMEZONE\r\n' +
      'TZID:America/Toronto\r\n' +
      'X-LIC-LOCATION:America/Toronto\r\n' +
      'BEGIN:DAYLIGHT\r\n' +
      'TZOFFSETFROM:-0500\r\n' +
      'TZOFFSETTO:-0400\r\n' +
      'TZNAME:EDT\r\n' +
      'DTSTART:19700308T020000\r\n' +
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU\r\n' +
      'END:DAYLIGHT\r\n' +
      'BEGIN:STANDARD\r\n' +
      'TZOFFSETFROM:-0400\r\n' +
      'TZOFFSETTO:-0500\r\n' +
      'TZNAME:EST\r\n' +
      'DTSTART:19701101T020000\r\n' +
      'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU\r\n' +
      'END:STANDARD\r\n' +
      'END:VTIMEZONE\r\n' +
      content +
      'END:VCALENDAR\r\n'
    );
  };

  return {
    init: init,
    addSection: addSection,
    addInvalidSection: addInvalidSection
  };
}());

function main() {
  moment.locale(getLocale());
  DownloadLink.show('generating');
  var courses = {};
  var count = 0;

  // search all the courses/sections
  $('[id^=UW_PREENRL_L_VW_SUBJECT]').each(function() {
    var siblings = $(this).first().parent().parent().siblings();

    var subject = $(this).text();
    var catalog_nbr = $(siblings).find('[id^=UW_PREENRL_L_VW_CATALOG_NBR]').text();
    var class_section = $(siblings).find('[id^=UW_PREENRL_L_VW_CLASS_SECTION]').text();

    if (subject === 'SEQ' || subject === 'PD'/* || /^2/i.test(class_section)*/) {
      // skip co-op sequences, PD, and TST
      return;
    }
    count++;
    var course_name = subject + '' + catalog_nbr;
    var course = {
      subject: subject,
      catalog_number: catalog_nbr,
      section: class_section
    };
    if (courses[course_name] === undefined) {
      courses[course_name] = [course];
    } else {
      courses[course_name].push(course);
    }
  });

  // initialize calendar with total number of sections
  Calendar.init(count);

  // search for term id
  var term_string = $('#TERM_TBL_DESCR').text().split(' ');
  OpenDataAPI.getTermsListings(function(resp) {
    var term_id = 0;
    $.each(resp['data']['listings'][term_string[1]], function(index, val) {
      if (val['name'].indexOf(term_string[0]) > -1) {
        term_id = val['id'];
      }
    });
    if (term_id == 0) { // could not seem to find term id
      var ENTER_TERM_STRING = '[WatCal] Could not identify term. Please visit http://www.adm.uwaterloo.ca/infocour/CIR/SA/under.html and enter the term id here. (e.g. 1169 for Fall 2016)';
      term_id = prompt(ENTER_TERM_STRING);
      if (isNaN(term_id)) {
        term_id = prompt(ENTER_TERM_STRING);
      }
    }
    if (isNaN(term_id)) {
      DownloadLink.show('error', 'Could not identify term.');
      return;
    }

    // search for courses
    $.each(courses, function(course_name, sections) {
      OpenDataAPI.getCourseScheduleByTerm(term_id, sections[0].subject, sections[0].catalog_number, function(resp) {
        sections.forEach(function(course) {
          var section_found = false;
          $.each(resp['data'], function(index, val) {
            if (val.section.indexOf(course.section) > -1) {
              Calendar.addSection(val);
              section_found = true;
              return;
            }
          });
          if (!section_found) { // could not seem to find section
            Calendar.addInvalidSection(course);
          }
        });
      });
    });
  });
};

// Start checking after user selects a study term.
$(document).ready(function() {
  $('.SSSTABACTIVE').each(function() {
    if ($(this).text() === 'view my class enrollment results') {
      var check = $('#UW_DERIVED_CEM2_DESCR_X2');
      if (check !== null) {
        if (check.text() == 'Successful Course Enrollment') {
          main();
        }
      }
    }
  });
});
