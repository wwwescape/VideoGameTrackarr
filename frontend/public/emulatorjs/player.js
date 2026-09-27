// Reads the play session handed over by EmulatorPlayerDialog.tsx (query string), configures
// EmulatorJS through its window.EJS_* globals, then loads its loader.js from the self-hosted
// data/ folder (vendored by frontend/scripts/vendor-emulatorjs.mjs — never a CDN).
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var romUrl = params.get("rom");
  var core = params.get("core");
  var gameName = params.get("name");
  var lang = params.get("lang") || "en";

  function fail(message) {
    var el = document.getElementById("error");
    el.textContent = message;
    el.style.display = "block";
  }

  // Only ever load ROMs from this app's own signed-URL route, and only a plain core id —
  // this page is reachable directly, so don't let a crafted link point it anywhere else.
  var parsedRom;
  try {
    parsedRom = romUrl ? new URL(romUrl, window.location.href) : null;
  } catch (e) {
    parsedRom = null;
  }
  if (
    !parsedRom ||
    !/^\/api\/roms\/\d+\/content\//.test(parsedRom.pathname) ||
    !core ||
    !/^[a-z0-9_]+$/.test(core)
  ) {
    fail("This play link is invalid. Close the player and try again.");
    return;
  }

  // Everything EmulatorJS needs is self-hosted, but it still reaches out to its CDN in two
  // cases: an update check whenever the page is served from localhost (a common way to open
  // a self-hosted VGT), and a fallback download if a core file is missing locally. Neither
  // should ever leave this server, so refuse both at the source.
  var BLOCKED_HOST = /(^|\.)emulatorjs\.org$/i;
  function isBlocked(url) {
    try {
      return BLOCKED_HOST.test(new URL(String(url), window.location.href).hostname);
    } catch (e) {
      return false;
    }
  }
  // Blocked requests fail the way a plain network miss would (fetch: a 404 response; XHR: an
  // "error" event), so EmulatorJS takes its own normal "not found" path rather than hitting
  // an exception it doesn't expect.
  var originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = input && typeof input === "object" && "url" in input ? input.url : input;
    if (isBlocked(url)) {
      return Promise.resolve(
        new Response(null, { status: 404, statusText: "Blocked by VideoGameTrackarr" })
      );
    }
    return originalFetch(input, init);
  };
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__vgtBlocked = isBlocked(url);
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function () {
    if (this.__vgtBlocked) {
      var xhr = this;
      setTimeout(function () {
        xhr.dispatchEvent(new ProgressEvent("error"));
      }, 0);
      return;
    }
    return originalSend.apply(this, arguments);
  };

  // VGT language code -> EmulatorJS localization file name (data/localization/*.json).
  // EmulatorJS ships French as "af-FR". English is EmulatorJS's built-in default.
  var EJS_LANGUAGES = { en: "en-US", es: "es-ES", fr: "af-FR", pt: "pt-BR" };

  window.EJS_player = "#game";
  window.EJS_core = core;
  window.EJS_gameUrl = parsedRom.href;
  window.EJS_pathtodata = "/emulatorjs/data/";
  // Unique per ROM, so EmulatorJS's in-browser saves never collide between two ROMs that
  // happen to share a file name.
  window.EJS_gameName = gameName || "vgt-rom";
  window.EJS_startOnLoaded = true;
  window.EJS_color = "#7C4DFF";
  window.EJS_backgroundColor = "#000000";
  // Don't keep a second copy of the ROM in IndexedDB — it's re-fetched from this app's own
  // server each time.
  window.EJS_CacheLimit = 0;
  window.EJS_language = EJS_LANGUAGES[lang.split("-")[0]] || "en-US";
  // EmulatorJS's inverted flag: `false` turns OFF guessing the language from the browser
  // locale, so only the app's own language setting above applies.
  window.EJS_disableAutoLang = false;
  // How often the game's own in-game save is written out (and so synced to the server).
  window.EJS_defaultOptions = { "save-save-interval": "60" };

  // --- Save bridge ---------------------------------------------------------------------------
  // This page never calls the API. Save events go up to the app page hosting the iframe
  // (EmulatorPlayerDialog.tsx), which uploads them with its own login; saves to restore come
  // back down the same way. Both sides only accept messages from the same origin, and this
  // side only from its direct parent.
  var started = false;

  function toParent(message, transfer) {
    if (window.parent === window) return;
    window.parent.postMessage(message, window.location.origin, transfer || []);
  }

  function gameManager() {
    return window.EJS_emulator && window.EJS_emulator.gameManager;
  }

  // Mirrors EmulatorJS's own "load save file" button: write the bytes to the core's save
  // path (creating its folders), then have the core reload its save files.
  function importInGameSave(bytes) {
    var gm = gameManager();
    if (!gm) return;
    var path = gm.getSaveFilePath();
    var parts = path.split("/");
    var current = "";
    for (var i = 0; i < parts.length - 1; i++) {
      if (parts[i] === "") continue;
      current += "/" + parts[i];
      if (!gm.FS.analyzePath(current).exists) gm.FS.mkdir(current);
    }
    if (gm.FS.analyzePath(path).exists) gm.FS.unlink(path);
    gm.FS.writeFile(path, bytes);
    gm.loadSaveFiles();
  }

  // EmulatorJS skips its own download/browser handling when a listener exists.
  window.EJS_onSaveState = function (data) {
    var state = new Uint8Array(data.state);
    var send = function (screenshot) {
      toParent({ type: "vgt:saveState", state: state, screenshot: screenshot || null }, [
        state.buffer,
      ]);
    };
    if (data.screenshot) {
      send(data.screenshot);
      return;
    }
    // EmulatorJS 4.2.3 passes `screenshot: undefined` here: its Save State handler
    // destructures `{ screenshot }` from takeScreenshot(), which actually returns `{ blob }`.
    // Take the screenshot ourselves with the same capture settings it would have used.
    var emulator = window.EJS_emulator;
    var photo = (emulator.capture && emulator.capture.photo) || {};
    emulator
      .takeScreenshot(photo.source, photo.format, photo.upscale)
      .then(function (result) {
        send(result && result.blob);
      })
      .catch(function () {
        send(null);
      });
  };
  window.EJS_onLoadState = function () {
    toParent({ type: "vgt:loadStateRequest" });
  };
  window.EJS_onGameStart = function () {
    started = true;
    window.EJS_emulator.on("saveSaveFiles", function (bytes) {
      if (!bytes || !bytes.length) return;
      var copy = new Uint8Array(bytes);
      toParent({ type: "vgt:sram", bytes: copy }, [copy.buffer]);
    });
    toParent({ type: "vgt:started" });
  };

  window.addEventListener("message", function (event) {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    var message = event.data;
    if (!message || typeof message.type !== "string") return;
    try {
      if (message.type === "vgt:loadSram") {
        importInGameSave(new Uint8Array(message.bytes));
        // The server's save only arrives once the game is already running, and some games
        // read their save only at power-on — reset so the game boots with it in place, the
        // same as switching on a console with that cartridge save.
        gameManager().restart();
      } else if (message.type === "vgt:loadState") {
        gameManager().loadState(new Uint8Array(message.bytes));
      } else if (message.type === "vgt:message") {
        window.EJS_emulator.displayMessage(String(message.text));
      } else if (message.type === "vgt:flush") {
        // saveSaveFiles() fires the saveSaveFiles event (and so vgt:sram) synchronously,
        // so the parent always sees the final in-game save before vgt:flushed.
        if (started && gameManager()) gameManager().saveSaveFiles();
        toParent({ type: "vgt:flushed" });
      }
    } catch (e) {
      console.error("VideoGameTrackarr player:", e);
      if (message.type === "vgt:flush") toParent({ type: "vgt:flushed" });
    }
  });

  var script = document.createElement("script");
  script.src = "/emulatorjs/data/loader.js";
  script.onerror = function () {
    fail("The emulator files are missing from this installation.");
  };
  document.body.appendChild(script);
})();
