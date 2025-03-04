$(document).ready(function() {
    $.getJSON( "config.json", function( streamui_config ) {

        if (streamui_config.jitsi_url != '' && streamui_config.jitsi_multiview) {
            loadScript(`${streamui_config.jitsi_url}/external_api.js`, function() { jitsiMultiview(streamui_config); });
        }
        if (location.hash == '') {
            if (streamui_config.default_control_room){
                // use default random control room ID
                location.hash = "#control=" + streamui_config.default_control_room;
            } else {
                // generate random control room ID
                location.hash = "#control=" + Math.random().toString(16).substr(2, 8);
            }
        }
        var parameters = location.hash.replace('#', '').split('&').reduce((prev, item) => {
            var kv = item.split('='); return Object.assign({[kv[0]]: kv[1]}, prev); }, {});


        var socket = io(streamui_config.namespace, {path: streamui_config.path});

        socket.on('connect', function() {
            socket.emit('register', {type: 'user', room: parameters.control});
        });

        window.regie = new Vue({
            el: '#regie-container',
            data: {
                remote_control: false,
                jitsi_participants: null,
                config: streamui_config,
                JitsiClients: {},
                atem: null,
                jitsi: {},
                obs: {},
            },
            computed: {
                jitsi_sorted: function () {
                    return Object.values(this.jitsi).sort(function (a, b) {
                        return (a.id).localeCompare(b.id);
                    });
                }
            },
            watch: {},
            methods: {
                controlEvent: function(id, eventname, data) {
                    if(this.remote_control == true) {
                    console.log('main controlEvent', id, eventname, data);
                    socket.emit('room', {command: eventname, id: id, data: data});
                    } else {
                    alert("control not enabled.");
                    }
                },
                copyPlayerLink: function() {
                  var url = location.origin + location.pathname + "player.html#control="+parameters.control;
                  var el = $("<input>");
                  $("body").append(el);
                  el.val(url).select();
                  document.execCommand("copy");
                  el.remove();
                }
            }
        })

        socket.on('room', function(msg, cb) {
            if (cb) cb();
            if ( ! msg.type )
                return;
            switch (msg.type) {
                case 'jitsi':
                    Vue.set(regie.jitsi, msg.source, msg.data);
                    break;
                case 'atem':
                    Vue.set(regie, 'atem', msg.data);
                    break;
                case 'obs':
                    Vue.set(regie.obs, msg.source, msg.data);
                    break;
                case 'obs-media':
                    Vue.set(regie.obs[msg.source], 'media', msg.data.media);
                    break;
                case 'obs-preview':
                    Vue.set(regie.obs[msg.source], 'previewScreenshot', msg.data.previewScreenshot);
                    break;
                case 'disconnect':
                      Vue.delete(regie.jitsi, msg.source);
                    break;
            }
            console.log('Received room message: ', msg);
        });

        socket.on('register', function(status, cb) {
            console.log('registered status:' + status);
            socket.emit('room', {command: 'discover'});
            if (cb) cb();
        });

    });
});

function jitsiMultiview(config) {
  const options = {
    roomName: config.jitsi_multiview,
    userInfo: {
    },
    parentNode: document.querySelector('#video-multiview'),
    configOverwrite: {
      startWithAudioMuted: true,
      startWithVideoMuted: true,
      prejoinPageEnabled: true,
    },
    interfaceConfigOverwrite: {
      VERTICAL_FILMSTRIP: true,
      filmStripOnly: false,
      MAXIMUM_ZOOMING_COEFFICIENT: 1,
      DISABLE_VIDEO_BACKGROUND: true,
    }
  };
  const JitsiApi = new JitsiMeetExternalAPI(`${config.jitsi_url.replace(/^.+:\/\//, '')}`, options);

  JitsiApi.on('passwordRequired', function (){
    JitsiApi.executeCommand('password', config.jitsi_multiview_pass);
  });
}
