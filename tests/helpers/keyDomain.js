/**
 * The keys a test can press: a bounded domain, so a sweep over it can say
 * what it covered (TST-13).
 *
 * Every printable US character — the 95 printable ASCII characters, capital
 * letters included — and the 297 named keys of the UI Events `key` list (W3C,
 * "UI Events KeyboardEvent key Values"), with the function keys from F1 to
 * F24: 392 keys. `tests/keyTable.test.js` pins that count and content. A
 * handler that compares `event.key` with literals can only react to a key
 * outside this domain through a literal, which the source checks there hold
 * to it.
 */

/** The named keys, by the list's sections. */
export const NAMED_KEYS = [
  'Unidentified',
  // Modifier keys
  'Alt', 'AltGraph', 'CapsLock', 'Control', 'Fn', 'FnLock', 'Hyper', 'Meta', 'NumLock', 'ScrollLock', 'Shift',
  'Super', 'Symbol', 'SymbolLock',
  // White space, navigation and editing
  'Enter', 'Tab', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp',
  'Backspace', 'Clear', 'Copy', 'CrSel', 'Cut', 'Delete', 'EraseEof', 'ExSel', 'Insert', 'Paste', 'Redo', 'Undo',
  // User interface and device
  'Accept', 'Again', 'Attn', 'Cancel', 'ContextMenu', 'Escape', 'Execute', 'Find', 'Finish', 'Help', 'Pause', 'Play',
  'Props', 'Select', 'ZoomIn', 'ZoomOut', 'BrightnessDown', 'BrightnessUp', 'Eject', 'LogOff', 'Power', 'PowerOff',
  'PrintScreen', 'Hibernate', 'Standby', 'WakeUp',
  // Input methods and composition
  'AllCandidates', 'Alphanumeric', 'CodeInput', 'Compose', 'Convert', 'Dead', 'FinalMode', 'GroupFirst',
  'GroupLast', 'GroupNext', 'GroupPrevious', 'ModeChange', 'NextCandidate', 'NonConvert', 'PreviousCandidate',
  'Process', 'SingleCandidate', 'HangulMode', 'HanjaMode', 'JunjaMode', 'Eisu', 'Hankaku', 'Hiragana',
  'HiraganaKatakana', 'KanaMode', 'KanjiMode', 'Katakana', 'Romaji', 'Zenkaku', 'ZenkakuHankaku',
  // General-purpose function keys
  ...Array.from({ length: 24 }, (_, index) => `F${index + 1}`), 'Soft1', 'Soft2', 'Soft3', 'Soft4',
  // Multimedia, audio and speech
  'ChannelDown', 'ChannelUp', 'Close', 'MailForward', 'MailReply', 'MailSend', 'MediaClose', 'MediaFastForward',
  'MediaPause', 'MediaPlay', 'MediaPlayPause', 'MediaRecord', 'MediaRewind', 'MediaStop', 'MediaTrackNext',
  'MediaTrackPrevious', 'New', 'Open', 'Print', 'Save', 'SpellCheck', 'Key11', 'Key12', 'AudioBalanceLeft',
  'AudioBalanceRight', 'AudioBassBoostDown', 'AudioBassBoostToggle', 'AudioBassBoostUp', 'AudioFaderFront',
  'AudioFaderRear', 'AudioSurroundModeNext', 'AudioTrebleDown', 'AudioTrebleUp', 'AudioVolumeDown',
  'AudioVolumeUp', 'AudioVolumeMute', 'MicrophoneToggle', 'MicrophoneVolumeDown', 'MicrophoneVolumeUp',
  'MicrophoneVolumeMute', 'SpeechCorrectionList', 'SpeechInputToggle',
  // Applications, browser and phone
  'LaunchApplication1', 'LaunchApplication2', 'LaunchCalendar', 'LaunchContacts', 'LaunchMail',
  'LaunchMediaPlayer', 'LaunchMusicPlayer', 'LaunchPhone', 'LaunchScreenSaver', 'LaunchSpreadsheet',
  'LaunchWebBrowser', 'LaunchWebCam', 'LaunchWordProcessor', 'BrowserBack', 'BrowserFavorites', 'BrowserForward',
  'BrowserHome', 'BrowserRefresh', 'BrowserSearch', 'BrowserStop', 'AppSwitch', 'Call', 'Camera', 'CameraFocus',
  'EndCall', 'GoBack', 'GoHome', 'HeadsetHook', 'LastNumberRedial', 'Notification', 'MannerMode', 'VoiceDial',
  // Television and media controllers
  'TV', 'TV3DMode', 'TVAntennaCable', 'TVAudioDescription', 'TVAudioDescriptionMixDown',
  'TVAudioDescriptionMixUp', 'TVContentsMenu', 'TVDataService', 'TVInput', 'TVInputComponent1',
  'TVInputComponent2', 'TVInputComposite1', 'TVInputComposite2', 'TVInputHDMI1', 'TVInputHDMI2', 'TVInputHDMI3',
  'TVInputHDMI4', 'TVInputVGA1', 'TVMediaContext', 'TVNetwork', 'TVNumberEntry', 'TVPower', 'TVRadioService',
  'TVSatellite', 'TVSatelliteBS', 'TVSatelliteCS', 'TVSatelliteToggle', 'TVTerrestrialAnalog',
  'TVTerrestrialDigital', 'TVTimer', 'AVRInput', 'AVRPower', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow',
  'ColorF3Blue', 'ColorF4Grey', 'ColorF5Brown', 'ClosedCaptionToggle', 'Dimmer', 'DisplaySwap', 'DVR', 'Exit',
  'FavoriteClear0', 'FavoriteClear1', 'FavoriteClear2', 'FavoriteClear3', 'FavoriteRecall0', 'FavoriteRecall1',
  'FavoriteRecall2', 'FavoriteRecall3', 'FavoriteStore0', 'FavoriteStore1', 'FavoriteStore2', 'FavoriteStore3',
  'Guide', 'GuideNextDay', 'GuidePreviousDay', 'Info', 'InstantReplay', 'Link', 'ListProgram', 'LiveContent',
  'Lock', 'MediaApps', 'MediaAudioTrack', 'MediaLast', 'MediaSkipBackward', 'MediaSkipForward',
  'MediaStepBackward', 'MediaStepForward', 'MediaTopMenu', 'NavigateIn', 'NavigateNext', 'NavigateOut',
  'NavigatePrevious', 'NextFavoriteChannel', 'NextUserProfile', 'OnDemand', 'Pairing', 'PinPDown', 'PinPMove',
  'PinPToggle', 'PinPUp', 'PlaySpeedDown', 'PlaySpeedReset', 'PlaySpeedUp', 'RandomToggle', 'RcLowBattery',
  'RecordSpeedNext', 'RfBypass', 'ScanChannelsToggle', 'ScreenModeNext', 'Settings', 'SplitScreenToggle',
  'STBInput', 'STBPower', 'Subtitle', 'Teletext', 'VideoModeNext', 'Wink', 'ZoomToggle'
];

/**
 * Every printable US character: the letters as typed without Shift and as
 * capitals (which arrive with Shift, or with no modifier under Caps Lock), the
 * digits, every symbol and Space.
 */
export const PRINTABLE_KEYS = [
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'0123456789',
  ...'`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/? '
];

/** Every printable US character, and every named key. */
export const CANDIDATE_KEYS = [...PRINTABLE_KEYS, ...NAMED_KEYS];
