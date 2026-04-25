/**
 * HTTP Routes for Script Sync
 * Handles doGet, doPost, and doOptions (CORS)
 */

/**
 * Handle GET requests
 * Supports: ?action=ping, ?action=get_last_modified
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (!action) {
      return createErrorResponse('No action specified', 400);
    }
    
    switch (action) {
      case 'ping':
        return handlePing();
        
      case 'get_last_modified':
        return handleGetLastModified();
        
      default:
        return createErrorResponse('Unknown action: ' + action, 400);
    }
  } catch (error) {
    logError('doGet', error);
    return createErrorResponse('Server error: ' + error.toString(), 500);
  }
}

/**
 * Handle POST requests
 * Supports: action=initialize, action=sync
 */
function doPost(e) {
  try {
    // Parse JSON body
    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseError) {
      return createErrorResponse('Invalid JSON in request body', 400);
    }
    
    const action = data.action;
    
    if (!action) {
      return createErrorResponse('No action specified', 400);
    }
    
    switch (action) {
      case 'initialize':
        return handleInitialize(data.initData, data.selectedKeys, data.force || false);
        
      case 'sync':
        return handleSync(data.queue);
        
      case 'get_storage':
        return handleGetStorage(data.requestedKeys);
        
      case 'update_enabled_keys':
        return handleUpdateEnabledKeys(data.enabledKeys);
        
      default:
        return createErrorResponse('Unknown action: ' + action, 400);
    }
  } catch (error) {
    logError('doPost', error);
    return createErrorResponse('Server error: ' + error.toString(), 500);
  }
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function doOptions(e) {
  return createCorsResponse();
}

/**
 * Add CORS headers to all responses (called by Google Apps Script automatically)
 */
function addCorsHeaders(response) {
  return response
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Max-Age', '86400');
}

// Override the response methods to automatically add CORS headers
const _createSuccessResponse = createSuccessResponse;
const _createErrorResponse = createErrorResponse;
const _createCorsResponse = createCorsResponse;

createSuccessResponse = function(data) {
  return addCorsHeaders(_createSuccessResponse(data));
};

createErrorResponse = function(message, code) {
  return addCorsHeaders(_createErrorResponse(message, code));
};

createCorsResponse = function() {
  return addCorsHeaders(_createCorsResponse());
};
