Setup for OSX
-------------

1. [Install homebrew](http://brew.sh/)
1. `brew install node`
1. `brew install mongodb`
1. `git clone https://github.com/Longhouse-Games/infochess.git`
1. `cd infochess`
1. `npm install`
1. `gem install foreman`
1. Fill out your .env file:

```sh
DISABLE_CAS=true # set to false to hit the CAS host specified by CAS_HOST and CAS_HOST_FALLBACK
CAS_HOST="ask someone"
CAS_HOST_FALLBACK="ask someone"
EGS_HOST="localhost" # if running the liferay stub, use localhost
EGS_PORT="4000" # if running the liferay stub, it listens on this port
EGS_USERNAME="ask someone" # not needed for liferay stub
EGS_PASSWORD="ask someone" # not needed for liferay stub
PREFIX="/infochess"
PORT=3000
```
1. `foreman run`
1. `open http://localhost:3000/infochess/new?white=foo&black=bar&fmt=html&dbg=1`

Liferay Stub
------------

The Liferay stub is defined in Raven and mimics the behaviour of the ECCO liferay server. This includes retrieving player profiles and sending game updates. By default the following users are defined:
1. `foo`
1. `bar`

If `DISABLE_CAS=true` in your `.env` file is not set, these user accounts must be created on your CAS server.

Running the Server
------------------

1. `foreman run`
1. or, to start it but not run the liferay-stub: `foreman start -c liferay=0`

Deployment
----------

It's best to run the server on port 843. AVAST and a few other Antivirus programs block websockets and XHR polling on other ports. 843 offers maximum compatibility.

Behind a proxy, add this to your `.env` file:

```sh
SERVICE_URL="https://localhost" # should be the external URL of the app
```

You can use foreman to get upstart/runit/bluepill/inittab entries for the services. See more here: http://blog.daviddollar.org/2011/05/06/introducing-foreman.html
