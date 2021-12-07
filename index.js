// Get the hash of the url
const hash = window.location.hash
  .substring(1)
  .split('&')
  .reduce(function (initial, item) {
    if (item) {
      var parts = item.split('=');
      initial[parts[0]] = decodeURIComponent(parts[1]);
    }
    return initial;
  }, {});

window.location.hash = '';

// Set token
let _token = hash.access_token;

let player = {};
let currState = {}


const authEndpoint = 'https://accounts.spotify.com/authorize';

// Replace with your app's client ID, redirect URI and desired scopes
const clientId = 'e84079cbd00d4dab895651a22b90cb1e';
const redirectUri = 'https://spotifywebplayback.herokuapp.com';
const scopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'user-library-modify',
  'user-read-playback-state',
  'user-modify-playback-state'
];

// If there is no token, redirect to Spotify authorization
if (!_token) {
  window.location = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token`;
}

console.log("token", _token);
// Set up the Web Playback SDK

let deviceId;

this.progress_bar = document.querySelector("#progress_bar");

window.onSpotifyPlayerAPIReady = () => {
  player = new Spotify.Player({
    name: 'Spotify Web SDK',
    getOAuthToken: cb => { cb(_token); }
  })

  // Error handling
  player.on('initialization_error', e => console.error(e));
  player.on('authentication_error', e => {
    console.error(e)
    alert("Need a Premium Suscription")
  });
  player.on('account_error', e => {
    console.error(e)
    alert("Need a Premium Suscription")
  });
  player.on('playback_error', e => console.error(e));

  // Ready
  player.on('ready', data => {
    console.log('Ready with Device ID', data.device_id);
    deviceId = data.device_id;
  });

  // Playback status updates
  player.on('player_state_changed', (state) => {
    console.log("player_state_changed", state);
    if (state) {
      currState.paused = state.paused;
      currState.position = state.position;
      currState.duration = state.duration;
      currState.updateTime = performance.now();
      $('#current-track').attr('src', state.track_window.current_track.album.images[0].url);
      $('#current-track-name').text(state.track_window.current_track.name);
      showtimeStampOnplayer();
    }
  });

  // Connect to the player!
  player.connect().then((res) => {
    console.log("connected", res)
  });
}

function getASong() {
  topArtists();
}

// Get top 5 artist IDs
function topArtists() {
  $.ajax({
    url: "https://api.spotify.com/v1/me/top/artists?limit=5&time_range=short_term",
    type: "GET",
    beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', 'Bearer ' + _token); },
    success: function (data) {
      let ids = data.items.map(artist => artist.id).join(',');
      getRecommendations(ids);
    }
  });
}

// Get Recommendations based on artist seeds
function getRecommendations(seeds) {
  $.ajax({
    url: "https://api.spotify.com/v1/recommendations?seed_artists=" + seeds + '&limit=100',
    type: "GET",
    beforeSend: function (xhr) { xhr.setRequestHeader('Authorization', 'Bearer ' + _token); },
    success: function (data) {
      console.log("getRecommendations===", data)
      let trackUri = []
      for (let item in data.tracks) {
        trackUri.push(data.tracks[item].uri)
      }
      play(deviceId, trackUri);
    }
  });
}

// Play a specified track on the Web Playback SDK's device ID
function play(device_id, track) {
  console.log("track", track)
  //"spotify:track:6habFhsOp2NvshLv26DqMb"
  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device_id}`, {
    method: 'PUT',
    body: JSON.stringify(
      {
        uris: track,
        position_ms: 60000
      }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_token}`
    },
  }).then((res) => {
    console.log(res)
    console.log("currState===", currState);
    playIconChange();
    const timer = setInterval(() => {
      let position = getStatePosition();
      var audio = currState.duration;
      var cur = position;
      progress = (cur / audio) * 100;
      // console.log("progress", progress,position)
      // console.log("Current Postion", currState.position);
      document.querySelector("#progress").style.width = progress + "%";
      showtimeStampOnplayer();
    }, 1000);

    // GetPlaybackState();
    // seekToPosition(device_id, 60000)
  });
}

progress_bar.addEventListener("click", function (e) {
  var progress_bar = e.offsetX;
  var barWidth = e.target.offsetWidth;
  var audio = currState.duration;
  var progress = (progress_bar / barWidth) * 100;
  var currentTime = (progress * audio) / 100;
  console.log("currentTime", currentTime, typeof currentTime)

  // const isSeek = seekToPosition(deviceId, currentTime.toFixed(0))
  // if (isSeek) {
  //   document.querySelector("#progress").style.width = progress + "%";
  // }

  player.seek(currentTime).then(() => {
    console.log('Changed position!');
    document.querySelector("#progress").style.width = progress + "%";
  });
});

function toggleplay() {
  console.log("toggleplay==", currState)
  if (currState.hasOwnProperty('duration')) {
    player.togglePlay();
    if (currState && currState.paused) {
      $("#playpause").addClass("fa-pause");
      $("#playpause").removeClass("fa-play");
    } else {
      $("#playpause").removeClass("fa-pause");
      $("#playpause").addClass("fa-play");
    }
  }
}


function next() {
  player.nextTrack().then(() => {
    console.log('Skipped to next track!');
    playIconChange();
    player.seek(60 * 1000).then(() => {
      console.log('Changed position!');
    });
  });
}

function prev() {
  player.previousTrack().then(() => {
    console.log('Set to previous track!');
    playIconChange();
    player.seek(60 * 1000).then(() => {
      console.log('Changed position!');
    });
  });
}

function forward() {
  const currentPosition = getStatePosition();
  const seektime = +currentPosition.toFixed(0) + 15000;
  console.log("seektime=", millisToMinutesAndSeconds(seektime))
  player.seek(seektime).then(() => {
    console.log('Changed position!');
  });
}

function seekToPosition(device_id, position_ms) {
  fetch(`https://api.spotify.com/v1/me/player/seek?device_id=${device_id}&position_ms=${position_ms}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_token}`
    },
  }).then(data => {
    return true
  });
}

function GetPlaybackState() {
  fetch(`https://api.spotify.com/v1/me/player?additional_types=track&market=ES`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${_token}`
    },
  }).then(response => response.json())
    .then(data => console.log("GetPlaybackState===", data));
}


function getStatePosition() {
  if (currState.paused) {
    return currState.position;
  }
  let position = currState.position + (performance.now() - currState.updateTime);
  return position > currState.duration ? currState.duration : position;
}

function getStatePosition2() {
  if (currState.paused) {
    return currState.position ? millisToMinutesAndSeconds(currState.position) : millisToMinutesAndSeconds(null);
  }

  const position = currState.position + (performance.now() - currState.updateTime);
  return position > currState.duration ? millisToMinutesAndSeconds(currState.duration) : millisToMinutesAndSeconds(position) || 0;
}

function millisToMinutesAndSeconds(millis) {
  if (isNaN(millis)) {
    return 0 + ":" + ('00');

  }
  var minutes = Math.floor(millis / 60000);
  var seconds = ((millis % 60000) / 1000).toFixed(0);
  return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}

function playIconChange() {
  $("#playpause").addClass("fa-pause");
  $("#playpause").removeClass("fa-play");
}

function showtimeStampOnplayer(){
  if (currState.duration) {
    const currentTime = getStatePosition();
    const duration = currState.duration;
    $('#currenttime').text(millisToMinutesAndSeconds(currentTime));
    $('#durationtine').text(millisToMinutesAndSeconds(duration));
  }
};