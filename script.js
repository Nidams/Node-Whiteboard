var getUsers = function(room) {
  $.getJSON('/users', {
    room: room
  }, function(data) {
    $('#users').html('Connected ' + room + ': ' + data);
  });
};
var procede = function(name) {
  var color;
  smoke.prompt('What room? If the room doesn\'t exist yet, it will be made.', function(room) {
    if (room) {
      $.get('/join', {
          name: name,
          room: room
        }, function(data) {
          color = data;
          getUsers(room);
        }
      );
      $('#clear-all').click(function(ev) {
        ev.preventDefault();
        console.log('clear-all clicked');
      });

      var canvas = $('canvas#canvas');
      var context = canvas[0].getContext('2d');
      var mouse_down = false;
      function on_mousemove(ev) {
        var x = ev.pageX - canvas.offset().left;
        var y = ev.pageY - canvas.offset().top;
        if (mouse_down) {
          context.lineTo(x, y);
          context.strokeStyle = color;
          context.stroke();
          send_line_segment(x, y, x, y);
        }
      }

      function on_mouseup(ev) {
        mouse_down = false;
        getUsers(room);
      }
      
      function on_mousedown(ev) {
        mouse_down = true;
        getUsers(room);
        context.beginPath();
      }
      canvas.bind({
        'mousemove': on_mousemove,
        'mousedown': on_mousedown,
        'mouseup': on_mouseup
      });
      
      function send_line_segment(startX, startY, endX, endY) {
        var data = {
          room: room,
          color: color,
          x1: startX,
          y1: startY,
          x2: endX,
          y2: endY
        };
        $.get('/draw', data);
      }
    } else {
      window.location.href = window.location.href;
    }
  });
};
$(function() {
  smoke.prompt('What\'s your name?', function(name) {
    if (name) {
      procede(name);
    } else {
      window.location.href = window.location.href;
    }
  });
});
