//
// LibreTexts Conductor
// config.js
// SwaggerUI Paths for Projects
//

module.exports = {
    paths: {
        '/projects/all': {
            get: {
                tags: ['Projects'],
                description: "Retrieves all of a user's projects within the current Organization",
                parameters: [],
                responses: {
                    '200': {
                        description: "Standard server response object.",
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        'err': {
                                            type: 'boolean',
                                            description: 'the request status'
                                        },
                                        'projects': {
                                            type: 'array',
                                            items: {
                                                type: 'object'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
