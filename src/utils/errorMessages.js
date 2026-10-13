/**
 * User-Friendly Error Messages
 * Provides helpful error messages with recovery suggestions
 */

export const ERROR_MESSAGES = {
  // Storage Errors
  STORAGE_FULL: {
    title: 'Storage Full',
    message: 'Your browser storage is full. Try clearing old projects or recordings.',
    suggestions: [
      'Delete unused projects in the Projects panel',
      'Clear old recordings in the Video panel',
      'Export important settings before clearing'
    ]
  },
  STORAGE_SAVE_FAILED: {
    title: 'Failed to Save',
    message: 'Could not save settings to browser storage.',
    suggestions: [
      'Check if you\'re in private browsing mode',
      'Clear browser cache and try again',
      'Export settings to file as backup'
    ]
  },
  STORAGE_LOAD_FAILED: {
    title: 'Failed to Load',
    message: 'Could not load saved settings.',
    suggestions: [
      'Try resetting to factory defaults',
      'Import settings from a backup file'
    ]
  },

  // File Import/Export Errors
  FILE_PARSE_ERROR: {
    title: 'Invalid File Format',
    message: 'The selected file is not a valid Drum Painter settings file.',
    suggestions: [
      'Make sure you\'re importing a .json file exported from Drum Painter',
      'Check that the file isn\'t corrupted',
      'Try exporting settings again from the working copy'
    ]
  },
  FILE_READ_ERROR: {
    title: 'Cannot Read File',
    message: 'Unable to read the selected file.',
    suggestions: [
      'Check file permissions',
      'Try selecting the file again',
      'Make sure the file isn\'t open in another program'
    ]
  },
  FILE_EXPORT_ERROR: {
    title: 'Export Failed',
    message: 'Could not export settings to file.',
    suggestions: [
      'Check if you have permission to save files',
      'Try a different location',
      'Copy settings to clipboard using D key'
    ]
  },

  // Project Errors
  PROJECT_LOAD_ERROR: {
    title: 'Project Load Failed',
    message: 'Could not load the selected project.',
    suggestions: [
      'The project may be corrupted',
      'Try loading a different project',
      'Delete and recreate the project'
    ]
  },
  PROJECT_SAVE_ERROR: {
    title: 'Project Save Failed',
    message: 'Could not save the project.',
    suggestions: [
      'Check browser storage space',
      'Try a shorter project name',
      'Export project settings to file instead'
    ]
  },

  // MIDI Errors
  MIDI_ACCESS_DENIED: {
    title: 'MIDI Access Denied',
    message: 'Browser blocked MIDI access. Please allow MIDI permission.',
    suggestions: [
      'Click the lock icon in the address bar',
      'Set MIDI permission to "Allow"',
      'Refresh the page after changing permission'
    ]
  },
  MIDI_NOT_SUPPORTED: {
    title: 'MIDI Not Supported',
    message: 'Your browser doesn\'t support Web MIDI API.',
    suggestions: [
      'Use Chrome, Edge, or Opera browser',
      'Update your browser to the latest version',
      'Test paint with mouse clicks while waiting'
    ]
  },
  MIDI_DEVICE_ERROR: {
    title: 'MIDI Device Error',
    message: 'Could not connect to MIDI device.',
    suggestions: [
      'Make sure the device is plugged in and powered on',
      'Try unplugging and reconnecting the device',
      'Refresh the page after reconnecting',
      'Check device connections in your OS settings'
    ]
  },

  // Video Recording Errors
  VIDEO_START_ERROR: {
    title: 'Recording Failed to Start',
    message: 'Could not start video recording.',
    suggestions: [
      'Make sure your browser supports MediaRecorder',
      'Try refreshing the page',
      'Close other tabs that might be using the camera/screen'
    ]
  },
  VIDEO_MERGE_ERROR: {
    title: 'Audio Merge Failed',
    message: 'Could not merge audio with video.',
    suggestions: [
      'File size limit: audio + video must fit in browser memory — keep total under ~250 MB',
      'WAV files are uncompressed and very large — convert to MP3 before merging',
      'Make sure the audio file is a valid format (MP3, WAV, OGG, etc.)',
      'Try a shorter recording or smaller audio file',
      'Check browser console for detailed error'
    ]
  },
  VIDEO_SAVE_ERROR: {
    title: 'Video Save Failed',
    message: 'Could not save the video recording.',
    suggestions: [
      'Check if you have permission to save files',
      'Try downloading again',
      'Recording may be too large - try shorter sessions'
    ]
  },
  // Paint/Rendering Errors
  PAINT_ERROR: {
    title: 'Paint Error',
    message: 'An error occurred while painting.',
    suggestions: [
      'This is usually a temporary glitch',
      'Try clicking/drumming again',
      'If it persists, try refreshing the page',
      'Check browser console for details'
    ]
  },
  CANVAS_ERROR: {
    title: 'Canvas Error',
    message: 'Problem with the drawing canvas.',
    suggestions: [
      'Try refreshing the page',
      'Clear the canvas (Backspace)',
      'Check if your GPU supports WebGL',
      'Close other graphics-intensive tabs'
    ]
  },

  // Generic fallback
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'An unexpected error occurred.',
    suggestions: [
      'Try refreshing the page',
      'Check browser console for details',
      'Report the issue if it persists'
    ]
  }
};

/**
 * Format an error message for display
 * @param {string} errorType - Key from ERROR_MESSAGES
 * @param {Error} error - Original error object (optional)
 * @returns {string} Formatted error message
 */
export function formatErrorMessage(errorType, error = null) {
  const errorInfo = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;

  let message = `❌ ${errorInfo.title}\n\n${errorInfo.message}`;

  if (errorInfo.suggestions && errorInfo.suggestions.length > 0) {
    message += '\n\n💡 What to try:\n';
    errorInfo.suggestions.forEach((suggestion, index) => {
      message += `${index + 1}. ${suggestion}\n`;
    });
  }

  if (error && error.message) {
    message += `\n\n🔍 Technical details: ${error.message}`;
  }

  return message;
}

/**
 * Show user-friendly error notification
 * @param {Object} notificationSystem - NotificationSystem instance
 * @param {string} errorType - Key from ERROR_MESSAGES
 * @param {Error} error - Original error object (optional)
 */
export function showUserFriendlyError(notificationSystem, errorType, error = null) {
  const errorInfo = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.UNKNOWN_ERROR;

  // Show brief notification
  notificationSystem.show(`${errorInfo.title}: ${errorInfo.message}`, 'error');

  // Log full details to console in debug mode
  console.group(`❌ ${errorInfo.title}`);
  console.error(errorInfo.message);
  if (errorInfo.suggestions) {
    console.log('💡 Suggestions:');
    errorInfo.suggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }
  if (error) {
    console.error('Technical details:', error);
  }
  console.groupEnd();
}
