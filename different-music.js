(() => {
  "use strict";

  const tracks = [
    {name:"Midnight Circuit",tempo:92,wave:"triangle",melody:[57,60,64,67,64,60,55,59,62,67,64,62,60,55,52,59],bass:[33,36,31,38]},
    {name:"Rainy Checkpoint",tempo:78,wave:"sine",melody:[69,72,76,79,76,72,67,71,74,77,74,71,69,67,64,67],bass:[45,48,43,41]},
    {name:"Galaxy Garden",tempo:106,wave:"triangle",melody:[64,67,71,74,76,74,71,67,62,66,69,73,71,69,66,62],bass:[40,43,38,35]},
    {name:"Velvet Velocity",tempo:128,wave:"sawtooth",melody:[62,69,74,69,66,73,78,73,64,71,76,71,67,74,79,74],bass:[38,45,42,47]},
    {name:"Quiet Afterglow",tempo:68,wave:"sine",melody:[60,64,67,71,72,71,67,64,59,62,66,69,67,66,62,59],bass:[36,40,35,32]}
  ];

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const panel = $("#different-music-panel");
  const toggle = $("#different-music-toggle");
  let context = null;
  let master = null;
  let timer = null;
  let playing = false;
  let trackIndex = -1;
  let step = 0;
  let nextTime = 0;
  let requestId = 0;
  let volume = 0.35;

  try {
    volume = Math.min(1, Math.max(0, Number(localStorage.getItem("gamezone-different-music-volume")) ?? 35) / 100);
  } catch {
    volume = 0.35;
  }

  function updateUI() {
    $("#different-music-status").textContent = playing ? `Playing: ${tracks[trackIndex].name}` : "Choose a different track";
    toggle.classList.toggle("selected", playing);
    toggle.setAttribute("aria-pressed", String(playing));
    $$(".different-music-track").forEach((button, index) => {
      const active = playing && index === trackIndex;
      button.classList.toggle("is-playing", active);
      button.setAttribute("aria-label", `${active ? "Pause" : "Play"} ${tracks[index].name}`);
      $("i", button).textContent = active ? "Ⅱ" : "▶";
    });
    $("#different-music-volume").value = String(Math.round(volume * 100));
    $("#different-music-volume-value").textContent = `${Math.round(volume * 100)}%`;
  }

  function note(midi, when, duration, wave, level) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), when);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(level, when + 0.018);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.03);
  }

  function schedule(track) {
    const position = step % track.melody.length;
    const beat = 60 / track.tempo / 2;
    const when = nextTime;
    if (track.melody[position] >= 0) {
      note(track.melody[position], when, beat * 1.15, track.wave, 0.055);
    }
    if (position % 4 === 0) {
      note(track.bass[Math.floor(position / 4) % track.bass.length], when, beat * 3.1, "triangle", 0.09);
    }
    step++;
    nextTime += beat;
  }

  function pause() {
    requestId++;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    playing = false;
    if (master && context) {
      master.gain.setTargetAtTime(0, context.currentTime, 0.025);
    }
    updateUI();
  }

  async function start(index) {
    if (playing && trackIndex === index) {
      pause();
      return;
    }

    const request = ++requestId;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    playing = false;
    if (master && context) {
      master.gain.setTargetAtTime(0, context.currentTime, 0.025);
    }
    updateUI();

    try {
      if (!context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error("Web Audio is not supported");
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
      }
      await context.resume();
      if (request !== requestId) return;

      trackIndex = index;
      step = 0;
      nextTime = context.currentTime + 0.05;
      playing = true;
      master.gain.setTargetAtTime(volume, context.currentTime, 0.025);
      const track = tracks[index];
      timer = setInterval(() => {
        if (!playing) return;
        const now = context.currentTime;
        if (nextTime < now - 0.5) nextTime = now + 0.05;
        while (nextTime < now + 0.12) schedule(track);
      }, 25);
      updateUI();
    } catch (error) {
      if (request === requestId) {
        console.error("Could not start alternate music:", error);
      }
    }
  }

  toggle.addEventListener("click", () => {
    const open = !panel.classList.contains("open");
    panel.classList.toggle("open", open);
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", String(open));
    updateUI();
  });

  $("#different-music-close").addEventListener("click", () => {
    panel.classList.remove("open");
    panel.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
  });

  panel.addEventListener("click", event => {
    const track = event.target.closest("[data-different-track]");
    if (track) start(Number(track.dataset.differentTrack));
  });

  $("#different-music-volume").addEventListener("input", event => {
    volume = Number(event.target.value) / 100;
    try {
      localStorage.setItem("gamezone-different-music-volume", String(Math.round(volume * 100)));
    } catch {
      // Volume remains active for this page even if storage is unavailable.
    }
    if (master && context) master.gain.setTargetAtTime(volume, context.currentTime, 0.03);
    $("#different-music-volume-value").textContent = `${Math.round(volume * 100)}%`;
  });

  $("#different-music-stop").addEventListener("click", () => {
    pause();
    trackIndex = -1;
    updateUI();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".different-music-player")) {
      panel.classList.remove("open");
      panel.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  window.addEventListener("keydown", event => {
    if (event.key === "Escape" && panel.classList.contains("open")) {
      panel.classList.remove("open");
      panel.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    }
  });

  updateUI();
})();
