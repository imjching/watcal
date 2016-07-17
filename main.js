/**
* WatCal
* Jay Ching Lim
*/

function getDateString(date) {
  var month = date.getMonth() + 1;
  if (month < 10) {
    month = '0' + month;
  }
  var day = date.getDate();
  if (day < 10) {
    day = '0' + day;
  }
  return '' + date.getFullYear() + month + day;
}

function getTimeString(time) {
  var timeString = time;
  if (time.match(/[AP]M/)) {
    var timeString = time.substr(0, time.length - 2);
  }
  var parts = timeString.split(':');
  if (parts[0].length !== 2) {
    parts[0] = '0' + parts[0];
  }
  timeString = parts.join('') + '00';
  if (time.match(/PM/) && parts[0] < 12) {
    timeString = (parseInt(timeString, 10) + 120000).toString();
  }
  return timeString;
}

function toHHMM(time) {
  var sec_num = parseInt(time, 10); // don't forget the second param
  var hours   = Math.floor(sec_num / 3600);
  var minutes = Math.floor((sec_num - (hours * 3600)) / 60);

  if (hours   < 10) {hours   = "0"+hours;}
  if (minutes < 10) {minutes = "0"+minutes;}
  return hours+':'+minutes;
}

function getDateTimeString(date, time) {
  return getDateString(date) + 'T' + getTimeString(time);
}

function getDaysOfWeek(daysOfWeekArray) {
  var formattedDays = [];

  for (var d = 0; d < daysOfWeekArray.length; d++) {
    if (daysOfWeekArray[d] == 'Su') {
      formattedDays.push('SU');
    }
    if (daysOfWeekArray[d] == 'M') {
      formattedDays.push('MO');
    }
    if (daysOfWeekArray[d] == 'T') {
      formattedDays.push('TU');
    }
    if (daysOfWeekArray[d] == 'W') {
      formattedDays.push('WE');
    }
    if (daysOfWeekArray[d] == 'Th') {
      formattedDays.push('TH');
    }
    if (daysOfWeekArray[d] == 'F') {
      formattedDays.push('FR');
    }
    if (daysOfWeekArray[d] == 'S') {
      formattedDays.push('SA');
    }
  }

  return formattedDays.join(',');
}

function wrapICalContent(iCalContent) {
  return 'BEGIN:VCALENDAR\r\n' +
    'VERSION:2.0\r\n' +
    'PRODID:-//Jay Ching Lim/WatCal//EN\r\n' +
    iCalContent +
    'END:VCALENDAR\r\n';
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + '-' + s4() + '-' + s4() + '-' + s4();
}

function getLocale() {
  if (navigator.languages != undefined) {
    return navigator.languages[0];
  } else {
    return navigator.language;
  }
}

function toTitleCase(str) {
  return str.replace(/_/g, ' ').replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/**
 * Extracts course schedule info and creates a downloadable iCalendar (.ics) file.
 */
var main = function() {
  var iCalContentArray = [];

  var iCalContent =
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
    'END:VTIMEZONE\r\n';
  iCalContentArray.push(iCalContent);

  var timezone = 'America/Toronto';
  var numberOfEvents = 0;

  moment.locale(getLocale());

  var courses = {};
  // {
  //   'math135': ['001', '109'];
  // }

  $('[id^=UW_PREENRL_L_VW_SUBJECT]').each(function() {
    var siblings = $(this).first().parent().parent().siblings();

    var subject = $(this).text();
    var catalog_nbr = $(siblings).find('[id^=UW_PREENRL_L_VW_CATALOG_NBR]').text();
    var class_section = $(siblings).find('[id^=UW_PREENRL_L_VW_CLASS_SECTION]').text();

    var course_name = subject.toLowerCase() + catalog_nbr;
    if (courses[course_name] === undefined) {
      courses[course_name] = [class_section];
    } else {
      courses[course_name].push(class_section);
    }
  });

  // console.log(JSON.stringify(courses));

  // override getJSON config
  $.ajaxSetup({ async: false }); // bad, but it's ok

  // TODO, only execute all of these when user clicks on download schedule
  var json_data = {};
  // load json and keep the data first
  for (var subject in courses) {
    // skip loop if the property is from prototype
    if(!courses.hasOwnProperty(subject)) {
      continue;
    }
    // skip co-op sequences too
    if (subject.match(/^seq/)) {
      continue;
    }

    $.getJSON( 'https://uwflow.com/api/v1/courses/' + subject + '/sections', function(data) {
      if (data['sections'] == undefined) {
        return;
      }
      // loop the section numbers
      for (var j = 0; j < courses[subject].length; j++) {
        // console.log('searching for ' + subject + ' : ' + courses[subject][j]);

        // for each section_number, check if it exists in the json data
        for (var i = 0; i < data['sections'].length; i++) {
          if (courses[subject][j] == data['sections'][i]['section_num'] && data['sections'][i]['term_id'] == '2016_09') {
            var sd = data['sections'][i];

            for (var k = 0; k < sd['meetings'].length; k++) {
              var meeting = sd['meetings'][k];

              var startTime = toHHMM(meeting['start_seconds']);
              var endTime = toHHMM(meeting['end_seconds']);
              var room = meeting['room'] == 'null' ? 'TBA' : meeting['building'] + ' ' + meeting['room'];
              var daysOfWeek = getDaysOfWeek(meeting['days']);
              var courseCode = sd['course_id'].toUpperCase();
              var component = sd['section_type'];
              if (component == 'TST') {
                continue; // skip this one
              }
              // var courseName
              var section = sd['section_num']
              var instructor = meeting['prof_id'] == null ? 'TBA' : toTitleCase(meeting['prof_id']);
              var classNumber = sd['class_num'];
              var startEndDate = '09/08/2016 - 12/05/2016'; //standard for fall 2016

              // Start the event one day before the actual start date, then exclude it in an exception date
              // rule. This ensures an event does not occur on startDate if startDate is not on part of daysOfWeek.
              var startDate = moment(startEndDate.substring(0, 10), 'L').toDate();
              startDate.setDate(startDate.getDate() - 1);

              // End the event one day after the actual end date. Technically, the RRULE UNTIL field should
              // be the start time of the last occurrence of an event. However, since the field does not
              // accept a timezone (only UTC time) and Toronto is always behind UTC, we can just set the
              // end date one day after and be guaranteed that no other occurrence of this event.
              var endDate = moment(startEndDate.substring(13, 23), 'L').toDate();
              endDate.setDate(endDate.getDate() + 1);

              var currentDate = moment(new Date(new Date().getTime()).toLocaleDateString()).toDate();
              var currentTime = new Date(new Date().getTime()).toLocaleTimeString().replace(/:\d+ /, '');

              // DTSTAMP doesn't matter
              var iCalContent =
                'BEGIN:VEVENT\r\n' +
                'DTSTART;TZID=' + timezone + ':' + getDateTimeString(startDate, startTime) + '\r\n' +
                'DTEND;TZID=' + timezone + ':' + getDateTimeString(startDate, endTime) + '\r\n' +
                'DTSTAMP:' + getDateTimeString(currentDate, currentTime) + '\r\n' +
                'LOCATION:' + room + '\r\n' +
                'RRULE:FREQ=WEEKLY;UNTIL=' + getDateTimeString(endDate, endTime) + 'Z;BYDAY=' + daysOfWeek + '\r\n' +
                'EXDATE;TZID=' + timezone + ':' + getDateTimeString(startDate, startTime) + '\r\n' +
                'SUMMARY:' + courseCode + ' (' + component + ') in ' + room + '\r\n' +
                'DESCRIPTION:' +
                  'Section: ' + section + '\\n' +
                  'Instructor: ' + instructor + '\\n' +
                  'Class Number: ' + classNumber + '\\n' +
                  'Start/End Date: ' + startEndDate + '\\n\r\n' +
                'UID:' + guid() + '\r\n' +
                'END:VEVENT\r\n';

              // console.log(iCalContent);

              iCalContentArray.push(iCalContent);
              numberOfEvents++;

            }
            break;
          }
        }
      }
    });
  }

  // If no events were found, notify the user. Otherwise, proceed to download the ICS file.
  if ($('#UW_DERIVED_CEM2_DESCR_X2').text().indexOf('Download') < 0) {
    if (numberOfEvents === 0) {
      $('#UW_DERIVED_CEM2_DESCR_X2').append(' (<a href="#">Download Schedule</a>)').click(function() {
        alert('Unable to create a schedule. No sections found.');
        return false;
      });
    } else {
      var studentName = $('#DERIVED_SSTSNAV_PERSON_NAME').text().toLowerCase();
      studentName = studentName.replace(/\ /g, '-');  // Replace spaces with dashes
      var fileName = studentName + '-uw-class-schedule.ics';

      $('#UW_DERIVED_CEM2_DESCR_X2').append(
        ' (<a href="data:text/calendar;charset=UTF-8,' +
        encodeURIComponent(wrapICalContent(iCalContentArray.join(''))) +
        '" download="' + fileName + '">Download Schedule</a>)'
      );
    }
  }

  // console.log(iCalContentArray);
};

// Start checking after user selects a study term.
$(document).ready(function() {
  // Execute main function only when user is in the Enroll/my_class_schedule tab.
  $('.SSSTABACTIVE').each(function() {
    if ($(this).text() === 'view my class enrollment results') {
      var check = $('#UW_DERIVED_CEM2_DESCR_X2');
      if (check !== null) {
        if (check.text() == 'Successful Course Enrollment') {
          main();
          // console.log('found successful course enrollment');
        }
      }
    }
  });
});
