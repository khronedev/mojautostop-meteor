var map = new RouteMapRenderer();
var mapAffix = new RouteMapRenderer();

var routeDirectionsPixelStep = 0;
var routeDirections = [];

function hoverAffixMapOn(latLng){
	mapAffix.getGoogleMap().panTo(latLng);
}

Template.RouteBody.rendered = function(){
	$(".fancybox-image").fancybox();

	/*
	$(".fancybox-image").click(function(){
		return false;
	});
	*/

	// ~~~

	
	map.initIn('map-canvas', {
		zoom: 7,
		center: new google.maps.LatLng(52.40637, 16.92517),
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		disableDefaultUI: false
	});

	map.pushRoute(PublishedTrips.findOne({}), true, false);

	/*

	mapAffix.initIn('map-affix-canvas', {
		zoom: 7,
		center: new google.maps.LatLng(52.40637, 16.92517),
		mapTypeId: google.maps.MapTypeId.ROADMAP,
		disableDefaultUI: true
	});

	mapAffix.pushRoute(PublishedTrips.findOne({}), false);

	var trip = PublishedTrips.findOne({});
	for(var i = 0; i < trip.points.length; i++){
		for(var j = 0; j < trip.points[i].route.gmap_directions.length; j++){
			var latLng = trip.points[i].route.gmap_directions[j].coordsBegin;
			routeDirections.push(new google.maps.LatLng(latLng));
		}
	}

	routeDirectionsPixelStep = ($("#route-desc").height() - $(window).height()) / routeDirections.length;

	console.log(routeDirectionsPixelStep);

	if(routeDirectionsPixelStep > 0){
		/*
		$("#map-affix-container").affix({
			offset: {
    			top: $("#route-desc").offset().top,
    			left: 0,
    			bottom: $("#route-desc").offset().bottom
    		}
		});

		
		$(window).scroll(function(event){
			var scrollStatus = $(document).scrollTop() - $("#route-desc").offset().top;

			var stepStatus = Math.floor((scrollStatus / routeDirectionsPixelStep));

			if(stepStatus > 0){
				hoverAffixMapOn(routeDirections[stepStatus]);
				mapAffix.getGoogleMap().setZoom(10);
			}
			/*else {
				hoverAffixMapOn(routeDirections[0]);
				mapAffix.getGoogleMap().setZoom(10);
			}*
		});
		*
	}

	/*
	google.maps.event.addListener(mapAffix.getGoogleMap(), 'idle', function(){
		// mapAffix.getGoogleMap().setCenter();
		mapAffix.getGoogleMap().setZoom(10);
		hoverAffixMapOn(routeDirections[0]);
	});
	*/
};

Template.RouteBody.helpers({
	'points': function(){
		var points = PublishedTrips.findOne({}).points;
		
		var i = 0;
		return points.map(function(item){
			item.index = (i++);
			item.isEnd = (i === points.length);
			return item;
		});
	},
	'pointTypeHtml': function(){
		return '<img src="/'+this.type+'_marker.png">';
	},
	'parseInt': function(x){
		return Math.round(x);
	},
	'logLength': function(x){
		return Math.round(100 + ((Math.log10(x) - 1) / 1.5) * 100);
	}
});

Template.RB_RouteDesc.helpers({
	'parseInt': function(x){
		return Math.round(x);
	},
	'parseDuration': function(value){
		var val = Math.round(parseInt(value));
		try {
			return juration.stringify(val, { format: 'micro' });
		} catch(error){
			return 0;
		}
	}
});

// ~~~

Template.RouteHead.helpers({
	'user': function(){
		console.log(Meteor.users.findOne(this.user));
		return Meteor.users.findOne(this.user);
	},
	'duration': function(){
		return Math.ceil((this.endTime - this.beginTime) / (24 * 60 * 60 * 1000));
	},
	'parseInt': function(x){
		return Math.round(x);
	},
	'distanceDivDuration': function(){
		var duration = Math.ceil((this.endTime - this.beginTime) / (24 * 60 * 60 * 1000));
		return Math.floor(this.stats.distance  / duration);
	},
	'driversCount': function(){
		return this.points.length - 1;
	},
	'sumaricWaitingTime': function(){
		var waitingTime = 0;

		this.points.forEach(function(point){
			if(point.route.waitingTime)
				waitingTime += parseInt(point.route.waitingTime);
		});

		try {
			return juration.stringify(Math.round(waitingTime), { format: 'micro' });
		} catch(error){
			return 0;
		}
	},
	'co2': function(){
		var grams = Math.floor(this.stats.distance * 130);
		if(grams > 1000)
			return Math.floor(grams / 1000) + " kg"
		else
			return grams + " g";
	},
	'countries': function(){
		var countries = {};

		this.points.forEach(function(point){
			point.route.stats.countries.forEach(function(routeCountryStats){
				if(countries[routeCountryStats.countryCode] === undefined)
					countries[routeCountryStats.countryCode] = 0;

				countries[routeCountryStats.countryCode] += routeCountryStats.distance;
			});
		});

		return Object.keys(countries).map(function(country){
			return {
				countryName: country,
				distance: countries[country]
			};
		});
	}
});

Template.RouteCommonStats.helpers({
	'duration': function(){
		return Math.ceil((this.endTime - this.beginTime) / (24 * 60 * 60 * 1000));
	},
	'parseInt': function(x){
		return Math.round(x);
	},
	'distanceDivDuration': function(){
		var duration = Math.ceil((this.endTime - this.beginTime) / (24 * 60 * 60 * 1000));
		return Math.floor(this.stats.distance  / duration);
	},
	'driversCount': function(){
		return this.points.length - 1;
	},
	'sumaricWaitingTime': function(){
		var waitingTime = 0;

		this.points.forEach(function(point){
			if(point.route.waitingTime)
				waitingTime += parseInt(point.route.waitingTime);
		});

		try {
			return juration.stringify(Math.round(waitingTime), { format: 'micro' });
		} catch(error){
			return 0;
		}
	},
	'co2': function(){
		var grams = Math.floor(this.stats.distance * 130);
		if(grams > 1000)
			return Math.floor(grams / 1000) + " kg"
		else
			return grams + " g";
	},
	'countries': function(){
		var countries = {};

		this.points.forEach(function(point){
			point.route.stats.countries.forEach(function(routeCountryStats){
				if(countries[routeCountryStats.countryCode] === undefined)
					countries[routeCountryStats.countryCode] = 0;

				countries[routeCountryStats.countryCode] += routeCountryStats.distance;
			});
		});

		return Object.keys(countries).map(function(country){
			return {
				countryName: country,
				distance: countries[country]
			};
		});
	}
});

Template.PrintProfile.helpers({
	'source': function(){
		return Meteor.users.findOne(this.dataSource);
	},
	'showUserName': function(){
		return Meteor.users.findOne(this.dataSource).profile.specialNick.length > 0;
	}
});