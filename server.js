process.chdir(__dirname);

try {
  var nko = require('nko')('NNlLWzf6EhahtxjJ'); 
} catch (err) {}

var debug = process.argv[3] ? true : false,
    port = process.argv[2] ? process.argv[2] : 80,
    
    // users[id] holds .name, .color, .room, .needs_full_update, .clear for a user
    users = {},
    // user_update_buffer[id] holds list of objects to be sent to use with that id via /update
    user_update_buffer = {}, 
    // room_user_ids[room name] holds a list of user ids for users in that room
    room_user_ids = {},
    // room_data[room name] holds all the line data for a room
    room_data = {},
    
    lib = require('./helpers'),
    http = require('http'),
    url = require('url'),
    path = require('path'),
    qs = require('querystring'),
    fs = require('fs');

function refresh_usernames(room) {
  // send a username update to everyone in the given room
  // collect list of usernames in room
  var usernames = [], i;
  for (i in room_user_ids[room]) {
    usernames.push({name: users[room_user_ids[room][i]].name, color: users[room_user_ids[room][i]].color});
  }
  // update user list on the client
  for (i in room_user_ids[room]) {
    var other_id = room_user_ids[room][i];
    user_update_buffer[other_id].push({type: 'users', users: usernames});
  }
}

var app = http.createServer(function (req, res) {
  var uri = url.parse(req.url).pathname;
  switch (uri) {

    case '/':
      try {
        var room_name = url.parse(req.url).query.toString().replace('room=', '');
        if ( typeof room_user_ids[room_name] === 'undefined' ) {
          room_user_ids[room_name] = [];
          room_data[room_name] = [];
        }
      } catch(err) {}
      fs.readFile('index.html', function(err, data) {
        res.writeHead(200, lib.html);
        res.end(data);
      });
    break;

    case '/get-a-room':
      var new_room = lib.genRoom();
      if ( typeof room_user_ids[new_room] === 'undefined' ) {
        room_user_ids[new_room] = [];
        room_data[new_room] = [];
      }
      res.writeHead(200, lib.plain);
      res.end(new_room);
      console.log('created room: ' + new_room);
    break;

    case '/join':
      var get = url.parse(req.url).query.toString().split('&'),
          name = get[0].replace('name=', ''),
          room = get[1].replace('room=', ''),
          id = get[2].replace('id=', '');
      users[id] = {
        name: name,
        color: lib.genColor(),
        room: room,
        needs_full_update: true,
        clear: false
      };
      //TODO: check that room exists
      room_user_ids[room].push(id);
      user_update_buffer[id] = [];
      
      refresh_usernames(room);
      
      res.writeHead(200, lib.plain);
      res.end(users[id].color);
      console.log('added user ' + users[id].name + ' with id ' + id);
    break;

    case '/draw':
      try {
        var id = qs.parse(url.parse(req.url).query.toString()).id;
        var data = JSON.parse(qs.parse(url.parse(req.url).query.toString()).data).lines;
        
        console.log('draw from id ' + id + ' with line data: ' + data);
        
        var color = users[id].color;
        var room = users[id].room;

        // json to send to other clients
        var line_data = { type: "lines", lines: data, color: color }, i;
        
        // figure out who to send the new line data to
        for (i in room_user_ids[room]) {
          var other_id = room_user_ids[room][i];
          if (other_id !== id) {
            // we have a user which needs this data
            user_update_buffer[other_id].push(line_data);
          }
        }
        // always save the data as well
        room_data[room].push(line_data);
        
        //TODO: ink level
        
        res.writeHead(200, lib.plain);
        res.end("success");
      } catch(err) {}
    break;
    
    case '/update':
      try {
        var id = url.parse(req.url).query.toString().replace('id=', '');
        console.log('update request from user id ' + id);
        // TODO: check validity of id
        try {
          if (users[id].needs_full_update === true) {
            // the user needs all the room data
            users[id].needs_full_update = false;
            user_update_buffer[id] = user_update_buffer[id].concat(room_data[users[id].room]);
          }
          if (users[id].clear === true) {
            users[id].clear = false;
            console.log(id + ' needs to clear');
            user_update_buffer[id] = 'clear';
          }
          if (user_update_buffer[id].length !== 0) {
            // there are pending updates to send
            res.writeHead(200, lib.plain);
            res.end(JSON.stringify(user_update_buffer[id]));
            user_update_buffer[id] = []; // empty the buffer
          } else {
            //TODO: long poll until there is something in the buffer?
            res.writeHead(200, lib.plain);
            res.end(JSON.stringify([])); // send empty list
          }
        } catch(err) {}
      } catch(err) {}
    break;

    //TODO: update this for post-refactor
    case '/clear':
      try {
        var room_name = url.parse(req.url).query.toString().replace('room=', ''), i;
        room_data[room_name] = [];
        for (i in room_user_ids[room_name]) {
          users[room_user_ids[room_name][i]].clear = true;
        }
        res.writeHead(200, lib.plain);
        res.end('1');
      } catch (err) {}
    break;

    case '/leave':
      try {
        var id = qs.parse(url.parse(req.url).query.toString()).id;
        // remove the user from relevant data structures
        var room = users[id].room;
        room_user_ids[room].splice(room_user_ids[room].indexOf(id), 1);
        delete users[id];
        delete user_update_buffer[id];
        // send updated username list to users in the same room
        refresh_usernames(room);
      } catch(err) {
        
      }
    break;

    default:
      var file = path.join(process.cwd(), uri), extension;
      path.exists(file, function(exists) {
        if (exists) {
          extension = file.lastIndexOf('.') < 0 ? '' : file.substring(file.lastIndexOf('.'));
          fs.readFile(file, function(err, data) {
            if ( extension === '.css' ) {
              res.writeHead(200, lib.css);
            } else if (extension === '.js') {
              res.writeHead(200, lib.js);
            } else if (extension === '.png') {
              res.writeHead(200, lib.png);
            }
            res.end(data);
          });
        }
      });
    break;
  }
});

app.listen(port, function() {
  console.log('Server listening on port ' + port + '.');
  try {
    // if running as root, downgrade to the owner of this file
    if (process.getuid() === 0) {
      fs.stat(__filename, function(err, stats) {
        if (err) {
          console.log(err);
        }
        process.setuid(stats.uid);
      });
    }
  } catch (err) {
    // poor windows
  }
});
