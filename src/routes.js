import Knex from './knex';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import GUID from 'node-uuid';

const routes = [
	{
    path: '/auth',
    method: 'POST',
    handler: ( request, reply ) => {
        // This is a ES6 standard
        // console.log(request.payload);
        const { username, password } = request.payload;

        const getOperation = Knex( 'users' ).where( {
            // Equiv. to `username: username`
            username,
        } ).select( 'guid', 'password' ).then( ( [user] ) => {

        	if( !user ) {

        		reply( {
            		error: true,
            		errMessage: 'the specified user was not found',
        		} );

    			// Force of habit. But most importantly, we don't want to wrap everything else in an `else` block; better is, just return the control.
        		return;
    		}

    		// Honestly, this is VERY insecure. Use some salted-hashing algorithm and then compare it.
			if( user.password === password ) {
				
			    const token = jwt.sign( {
			        // You can have anything you want here. ANYTHING. As we'll see in a bit, this decoded token is passed onto a request handler.
			        username,
			        scope: user.guid,
			    }, 
			    'vZiYpmTzqXMp8PpYXKwqc9ShQ1UhyAfy', 
			    {
			        algorithm: 'HS256',
			        expiresIn: '1h',
			    } );
// console.log(token);
			    reply( {
			        token,
			        scope: user.guid,
			    } );
			} else {
			    reply( 'incorrect password' );
			}

        } ).catch( ( err ) => {
            reply( err );
        } );
    },
    	config: {
    		validate:{
    			params:{
    				username: Joi.string().min(3).max(10),
    				password: Joi.string().min(3).max(50)
    			}
    		}
    	}
},
{
	method: 'GET',
	path:'/birds',
	handler: ( request, reply ) => {
    // In general, the Knex operation is like Knex('TABLE_NAME').where(...).chainable(...).then(...)
    const getOperation = Knex( 'birds' ).where( {
        isPublic: true
    } ).select( 'name', 'species', 'picture_url' ).then( ( results ) => {

        if( !results || results.length === 0 ) {
            reply( {
                error: true,
                errMessage: 'no public bird found',
            } );
        }

        reply( {
            dataCount: results.length,
            data: results,
        } );

    } ).catch( ( err ) => {
        reply( err );
    } );
	}
},
{

    path: '/birds',
    method: 'POST',
    config: {
    	auth: {
    		strategy: 'token'
    	}
    },
    handler: ( request, reply ) => {

        const { bird } = request.payload;

        const guid = GUID.v4();
// console.log( request.auth.credentials );
		const insertOperation = Knex( 'birds' ).insert( {

		    owner: request.auth.credentials.scope,
		    name: bird.name,
		    species: bird.species,
		    picture_url: bird.picture_url,
		    guid,

		} ).then( ( res ) => {

		    reply( {

		        data: guid,
		        message: 'successfully created bird'

		    } );

		} ).catch( ( err ) => {

		    reply( err );

		} );
    }
},
{

    path: '/birds/{birdGuid}',
    method: 'PUT',
    config: {
    	auth: {
    		strategy: 'token'
    	},
    	pre: [
	        {
	            method: ( request, reply ) => {
	            	const { birdGuid } = request.params, { scope } = request.auth.credentials;

	            	const getOperation = Knex( 'birds' ).where( {
					    guid: birdGuid,
					} ).select( 'owner' ).then( ( [ result ] ) => {
// console.log(result);
						if( !result ) {

						    reply( {
						        error: true,
						        errMessage: `the bird with id ${ birdGuid } was not found`
						    } ).takeover();
						}

						if( result.owner !== scope ) {

						    reply( {
						        error: true,
						        errMessage: `the bird with id ${ birdGuid } is not in the current scope`
						    } ).takeover();

						}

						return reply.continue();
					} );
	            }
	        }
	    ]
    },
    handler: ( request, reply ) => {

	    const { birdGuid } = request.params, { bird }  = request.payload;

	    const insertOperation = Knex( 'birds' ).where( {

	        guid: birdGuid,

	    } ).update( {

	        name: bird.name,
	        species: bird.species,
	        picture_url: bird.picture_url,
	        isPublic: bird.isPublic,

	    } ).then( ( res ) => {

	        reply( {

	            message: 'successfully updated bird'

	        } );

	    } ).catch( ( err ) => {

	        reply( 'server-side error' );

	    } );
	}
}

]

export default routes;