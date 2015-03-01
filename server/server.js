/*

server.js

*/

var CONFIG = {
	NEW_ID_ON_PUBLISH: true
};

function bindRoutesToPoints(points){
	if(points.length >= 2){
		for(var i = 0; i < points.length; i++){
			var nextRoutePointId = null;
			if(points[i + 1] != undefined)
				nextRoutePointId = points[i + 1].id;

			points[i].route = new Route(points[i].id, nextRoutePointId);
		}
	}
}

function getCountryCodeForCoords(coords){
	var lat = coords.k || coords.lat;
	var lon = coords.C || coords.lon;

	if(typeof lat !== "number" || typeof lon !== "number")
		return "";

	var ret = HTTP.get("http://nominatim.openstreetmap.org/reverse?format=json&zoom=0&lat=" + lat + "&lon=" + lon);

	return ret.data.address.country_code;
}

function getCountryCodeForName(name){
	var ret = HTTP.get("http://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=" + name);

	return ret.data[0].address.country_code;
}

Meteor.methods({
	'NewTrip': function(){
		if(Meteor.userId() !== null){
			return Trips.insert(new Trip("Nienazwany trip", Meteor.userId()));
		}
	},

	// ~~~

	'ChangeTripName': function(tripId, newTripName){
		Trips.update(tripId, {
			$set: { name: newTripName }
		});

		console.log("Renamed #" + tripId + " to \"" + newTripName + "\"");
	},

	'PublishTrip': function(tripId){
		// 1. publikowanie = obliczanie statystyk
		Meteor.call('GenerateStatsFor', tripId, function(error, trip){
			// 2. usunięcie starego tripa (jeśli w ogóle jakiś był)
			if(trip.publish.id !== null)
				PublishedTrips.remove(trip.publish.id);

			// 3. publikowanie = escapowanie danych
			trip._id = trip.publish.id;
			if(trip.publish.id === null || CONFIG.NEW_ID_ON_PUBLISH)
				delete trip._id;

			trip.points = trip.points.map(function(point){
				delete point.route.gmap_directions;
				return point;
			});

			// publish jest teraz w "drugą stronę"
			trip.publish.visible = true;
			trip.publish.id = tripId;

			// 3. publikowanie = kopiowanie escapeniętych danych
			var publishTripId = PublishedTrips.insert(trip);

			// ~~~

			Trips.update(tripId, {
				$set: {
					'publish.visible': true,
					'publish.id': publishTripId
				}
			});
		});
	},
	'UnPublishTrip': function(tripId){
		var trip = Trips.findOne(tripId);

		PublishedTrips.update(trip.publish.id, {
			$set: { 'publish.visible': false }
		});

		Trips.update(tripId, {
			$set: { 'publish.visible': false }
		});
	},

	// ~~~

	'NewRoutePoint': function(tripId, insertAfter, newPoint){
		var points = Trips.findOne(tripId).points;

		var newPoints = [];

		if(insertAfter == null)
			newPoints.push(newPoint);

		for(var i = 0; i < points.length; i++){
			var currPoint = points[i];

			newPoints.push(currPoint);
			if(insertAfter != null && currPoint.id == insertAfter){
				// dodaje się przejazd między punktem N-1 a N
				// więc trzeba czas czekania dodać do punktu N-1 a nie
				// zostawiac go w N
				currPoint.waitingTime = newPoint.waitingTime;
				newPoint.waitingTime = null;

				newPoints.push(newPoint);
			}
		}

		bindRoutesToPoints(newPoints);

		if(newPoints.length > points.length){
			console.log("Added new point after #" + insertAfter + " to trip #" + tripId);

			Trips.update(tripId, {
				$set: { points: newPoints }
			});
		}
		else{
			console.log("[ERR] Tried to add new point after #" + insertAfter + " to trip #" + tripId);
			console.log(newPoint);
		}
	},
	'RemoveRoutePoint': function(tripId, pointId){
		var points = Trips.findOne(tripId).points;

		var newPoints = points.filter(function(curr){
			return !(curr.id === pointId);
		});

		bindRoutesToPoints(newPoints);

		Trips.update(tripId, {
			$set: { points: newPoints }
		});

		console.log("Removed point #" + pointId + " from trip #" + tripId);
	},
	'EditRoutePoint': function(tripId, pointId, newPoint){
		newPoint.id = pointId;

		var newPoints = Trips.findOne(tripId).points.map(function(curr){
			if(curr.id == pointId)
				return newPoint;
			else
				return curr;
		});

		console.log("Replaced point #" + pointId + " to new version from trip #" + tripId);

		Trips.update(tripId, {
			$set: { points: newPoints }
		});
	},
	'AddTripRouteDirections': function(tripId, pointId, directions){
		var newPoints = Trips.findOne(tripId).points;

		for(var i = 0; i < newPoints.length; i++){
			if(newPoints[i].id === pointId){
				newPoints[i].route.gmap_directions = directions;
				break;
			}
		}

		Trips.update(tripId, {
			$set: { points: newPoints }
		});
	},

	// ~~~

	'GenerateStatsFor': function(tripId){
		var trip = Trips.findOne(tripId);

		trip.points = trip.points.map(function(point){
			if(point.route.endId !== null && point.route.gmap_directions.length > 0){
				var begin = point.route.gmap_directions[0].coordsBegin;
				var end = point.route.gmap_directions[point.route.gmap_directions.length - 1].coordsEnd;

				var countryBegin = getCountryCodeForCoords(begin);
				var countryEnd = getCountryCodeForCoords(end);

				// head odcinka (punkt) jest w jakimś konkretnym kraju
				point.stats.countryCode = countryBegin;

				// ~~~

				var dist = point.route.gmap_directions.reduce(function(prev, curr){
					return prev + (curr.distance / 1000);
				}, 0);

				// długość danego odcinka
				point.route.stats.distance = dist;

				// ~~~

				if(countryBegin === countryEnd){
					// prosta sprawa...
					point.route.stats.countries.push({
						countryCode: countryBegin,
						distance: dist
					});
				} else {
					// już trochę trudniej...
					var countryStats = {};
					var lastCountry = countryBegin;

					for(var i = 0; i < point.route.gmap_directions.length; i++){
						var countryBegin = getCountryCodeForCoords(point.route.gmap_directions[i].coordsBegin);
						var countryEnd = getCountryCodeForCoords(point.route.gmap_directions[i].coordsEnd);

						if(countryStats[countryBegin] == undefined)
							countryStats[countryBegin] = 0;

						if(countryStats[countryEnd] == undefined)
							countryStats[countryEnd] = 0;

						if(countryBegin === countryEnd)
							countryStats[countryBegin] += point.route.gmap_directions[i].distance;
						else {
							// to jest still chujowe
							countryStats[countryBegin] += Math.floor(point.route.gmap_directions[i].distance / 2);
							countryStats[countryEnd] += Math.floor(point.route.gmap_directions[i].distance / 2);
						}
					}

					point.route.stats.countries = [];
					for(var country in countryStats){
						point.route.stats.countries.push({
							countryCode: country,
							distance: countryStats[country]
						});
					}
				}
			} else {
				// ostatni punkt na trasie:
				point.stats.countryCode = getCountryCodeForName(point.name);
			}

			return point;
		});

		trip.stats.distance = trip.points.reduce(function(prev, point){
			return prev + point.route.stats.distance;
		}, 0);

		Trips.update(trip._id, trip);

		return trip;
	},

	// ~~~

	'g_GenerateStatsFor': function(){
		var trips = Trips.find({}).fetch();

		trips.forEach(function(trip){
			Meteor.call(trip._id);
		});
	}
});

Meteor.startup(function(){
	Meteor.publish("get-trip-data", function(tripId){
		return Trips.find({ _id: tripId });
	});

	Meteor.publish("get-published-trip-data", function(publishTripId){
		return PublishedTrips.find({ _id: publishTripId, 'publish.visible': true });
	});

	Meteor.publish("mine-trips", function(){
		if(this.userId !== null)
			return Trips.find({ user: this.userId });
	});
});