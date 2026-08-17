/**
 * Centralized Tooltip Content
 * All tooltip text in one place for easy maintenance and i18n.
 * 
 * Naming convention: SECTION_CONTROL_ACTION
 * 
 * @module tooltips
 */

export const TOOLTIPS = {
  // Marker section
  marker_size: 'Size of waypoint markers on the map (1-50 pixels)',
  marker_color: 'Fill color for waypoint markers',
  marker_label: 'Show or hide waypoint labels on the map',
  marker_label_size: 'Text size for waypoint labels',
  
  // Path section
  path_width: 'Thickness of the animated path line',
  path_color: 'Color of the path line between waypoints',
  path_style: 'Visual style: solid, dashed, or dotted',
  path_tension: 'Curve smoothness (0 = straight lines, 1 = smooth curves)',
  
  // Animation section
  animation_duration: 'Total time for the animation to complete',
  animation_speed: 'Playback speed multiplier (1x = normal)',
  animation_easing: 'How the animation accelerates and decelerates',
  segment_speed: 'Speed for this path segment relative to base speed',
  waypoint_pause: 'Pause duration when animation reaches this waypoint',
  
  // Camera section
  camera_zoom: 'Zoom level during animation (1 = no zoom)',
  camera_pan: 'Enable camera panning to follow the path',
  
  // Background section
  bg_upload: 'Upload an image to use as the map background',
  bg_tint: 'Apply a color overlay to the background image',
  bg_fit: 'How the image fits within the canvas area',
  
  // Export section
  export_format: 'Output format for the exported animation',
  export_quality: 'Quality level for compressed formats',
  export_fps: 'Frames per second for video export',
  
  // Playbar
  playbar_play: 'Play animation (Space)',
  playbar_pause: 'Pause animation (Space)',
  playbar_skip_start: 'Skip to start (Home)',
  playbar_skip_end: 'Skip to end (End)',
  playbar_timeline: 'Drag to scrub through the animation',
  
  // Header controls
  header_save: 'Save current project',
  header_load: 'Load a saved project',
  header_clear: 'Clear all waypoints and reset',
  header_help: 'Show keyboard shortcuts and help',
  header_edit: 'Switch to edit mode',
  header_preview: 'Switch to preview mode (hides editing controls)',
  
  // Waypoint list
  waypoint_select_all: 'Select all waypoints for batch editing',
  waypoint_add: 'Add a new waypoint at the center of the map',
  waypoint_delete: 'Delete this waypoint (Shift+Click)',
  waypoint_reorder: 'Drag to reorder waypoints',
  
  // Glossary terms (for technical jargon)
  glossary_bezier: 'A type of smooth curve used for path drawing',
  glossary_easing: 'How the animation speeds up or slows down',
  glossary_waypoint: 'A point along your route',
  glossary_beacon: 'A visual pulse effect at waypoints',
  glossary_catmull_rom: 'A smooth curve algorithm that passes through all control points'
};

export default TOOLTIPS;
