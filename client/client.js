/*

client.js

*/

RouteMapRenderer = function(){
	// zmienne:
	var map = null;
	var directionsDisplays = [];

	return {
		getGoogleMap: function(){
			return map;
		},
		initIn: function(mapContainerId, options){
			// inicjalizacja samej mapy:

			map = new google.maps.Map(
				document.getElementById(mapContainerId),
				options
			);

			directionsDisplays = [];
		},
		pushRoute: function(trip, showPoints){
			directionsDisplays.forEach(function(display){
				display.setMap(null);
			});

			directionsDisplays = [];

			if(trip.points.length >= 2){
				var points = trip.points;
				var k = 0;

				var directionsService = new google.maps.DirectionsService();
				function makeRequest(directionDisplay, requestObject){
					return function(){
						directionsService.route(requestObject, function(response, status){
							if(status == google.maps.DirectionsStatus.OK){
								directionDisplay.setDirections(response);

								function addPoint(leg_loc, point){
									if(!showPoints)
										return;

									function getMarkerNameForPoint(point_){
										return {
											url: '/' + point_.type + '_marker.png',
											size: new google.maps.Size(32, 32),
											origin: new google.maps.Point(0, 0),
											anchor: new google.maps.Point(16, 16)
										};
									}

									var point__ = new google.maps.Marker({
										position: leg_loc,
										title: "test",
										icon: getMarkerNameForPoint(point)
									});

									point__.setMap(map);
									directionsDisplays.push(point__);

									google.maps.event.addListener(point__, 'click', function() {
										editPointId.set(this.id);
										$("#edit-point-modal").modal('show');
									});
								}

								function processRoute(point, leg){
									if(showPoints){
										var dirs = leg.steps.map(function(item){
											var start_location = new google.map.LatLng(item.start_location);
											var end_location = new google.map.LatLng(item.end_location);

											start_location = {
												lat: start_location.lat(),
												lng: start_location.lng()
											};

											end_location = {
												lat: end_location.lat(),
												lng: end_location.lng()
											};

											var ret = {};
											ret.distance = item.distance.value;
											ret.coordsBegin = start_location;
											ret.coordsEnd = end_location;
											return ret;
										});

										Meteor.call('AddTripRouteDirections', trip._id, point.id, dirs);
									}
								}

								function processLeg(leg, point){
									addPoint(leg.end_location, point);
								}

								for(var i = 0; i < response.routes[0].legs.length; i++, k++){
									var point = points[k];

									if(i == 0){
										addPoint(response.routes[0].legs[i].start_location, point);
										
										k++;
										point = points[k];
									}

									processLeg(response.routes[0].legs[i], point);
									processRoute(points[k - 1], response.routes[0].legs[i]);
								}
							}
						});
					}
				}

				var maxPointsAtRequest = 10;

				var requests = [];

				for(var i = 0; i < points.length; i++){
					var pointsOffset = Math.floor(i / maxPointsAtRequest);
					var offsetPos = (i % maxPointsAtRequest);

					var isOrigin = (offsetPos == 0);
					var isDestination = (offsetPos == 9 || i == (points.length - 1));

					if(isOrigin){
						requests[pointsOffset] = {};
						requests[pointsOffset].travelMode = google.maps.TravelMode.DRIVING;
						requests[pointsOffset].waypoints = [];

						if(i == 0){
							requests[pointsOffset].origin = points[i].name;
						} else{
							requests[pointsOffset].origin = points[i-1].name;

							if(!isDestination){
								requests[pointsOffset].waypoints.push({
									location: points[i].name,
									stopover: true
								});
							} else{
								requests[pointsOffset].destination = points[i].name;
							}
						}
					} else if(isDestination){
						requests[pointsOffset].destination = points[i].name;
					} else {
						requests[pointsOffset].waypoints.push({
							location: points[i].name,
							stopover: true
						});
					}
				}

				for(var i = 0; i < requests.length; i++){
					var display = new google.maps.DirectionsRenderer({
						markerOptions: {
							visible: false
						}
					});

					directionsDisplays.push(display);

					display.setMap(map);
					Meteor.setTimeout(makeRequest(display, requests[i]), i * 500);
				}
			}
		}
	};
};

(function(){
	var routeId = undefined;

	var map_ = new RouteMapRenderer();

	var editPointId = new ReactiveVar(null);
	var insertAfterId = new ReactiveVar(null);

	var isRendered = false;

	var uploadedFiles = [];

	Template.EditTrip.rendered = function(){
		routeId = this._id;

		map_.initIn('map-canvas', {
			zoom: 7,
			center: new google.maps.LatLng(52.40637, 16.92517),
			mapTypeId: google.maps.MapTypeId.ROADMAP
			// disableDefaultUI: true
		});

		map_.pushRoute(Trips.findOne({}), true);

		isRendered = true;
		// makeRoute();

		$('[data-toggle="tooltip"]').tooltip();

		Uploader.finished = function(index, fileInfo, templateContext){
			uploadedFiles.push(fileInfo.url);
		};
	};

	Template.EditTrip.helpers({
		'points': function(){
			if(isRendered)
				map_.pushRoute(Trips.findOne({}), true);

			var points = Trips.findOne({}).points;
			
			var i = 0;
			return points.map(function(item){
				item.index = (i++);
				item.isEnd = (i === points.length);
				return item;
			});
		},
		'pointTypeHtml': function(){
			switch(this.type){
				case "normal":
					return '<span class="badge badge-normal-iconic"><span class="glyphicon glyphicon-map-marker"></span></span>';

				case "tent":
					return '<span class="badge badge-tent-iconic"><span class="glyphicon glyphicon-flag"></span></span>';

				case "house":
					return '<span class="badge badge-house-iconic"><span class="glyphicon glyphicon-home"></span></span>';
			}
		},
		'parseInt': function(x){
			return Math.round(x);
		}
	});

	Template.EditTrip.events({
		'click .point-action-remove': function(event){
			Meteor.call('RemoveRoutePoint', Trips.findOne({})._id, this.id);
		},
		'click .point-action-edit': function(event){
			editPointId.set(this.id);

			$("#edit-point-modal").find('.trip-name').val(this.name);
		},
		'click .point-action-add': function(event){
			insertAfterId.set(this.id);
		},
		'click #new-point-button': function(event){
			var points = Trips.findOne({}).points;
			if(points.length == 0)
				insertAfterId.set(null);
			else
				insertAfterId.set(points[points.length - 1].id);
		},
		'click #name-box > .name-show': function(event){
			if(event.currentTarget === event.target){
				$("#name-box > .name-show").hide();
				$("#name-box > .name-edit").show().focus();
			}
		},
		'keyup #name-box > .name-edit': function(event){
			if(event.which == 13){
				Meteor.call('ChangeTripName', this._id, $(event.currentTarget).val());

				$("#name-box > .name-show").show();
				$("#name-box > .name-edit").hide();
			}
		}
	});

	// ~~~

	Template.AddPointModal.events({
		'click #new-point': function(event){
			// pola wymagane:
			var placeName = $('#new-point-modal').find('.trip-name.selectize-control.single.selectized').val();
			
			// ~~~

			var routePoint = new RoutePoint(placeName);

			// pola dodatkowe:

			if($('#new-point-modal').find('input[name="point-type"]:checked').length == 1)
				routePoint.type = $('#new-point-modal').find('input[name="point-type"]:checked').val();

			if(	$('#new-point-modal').find('input[name="point-waiting-time"]').length == 1 &&
				$('#new-point-modal').find('input[name="point-waiting-time"]').val().length > 0){
				var inputValue = $('#new-point-modal').find('input[name="point-waiting-time"]').val();

				try {
					routePoint.waitingTime = juration.parse(inputValue);
				} catch(error){
					// propably do something
				}
			}

			if(	$('#new-point-modal').find('.description-text').length == 1 &&
				$('#new-point-modal').find('.description-text').val().length > 0)
				routePoint.desc.text = $('#new-point-modal').find('.description-text').val();

			routePoint.desc.pictures = uploadedFiles.slice(0); // clone [ http://davidwalsh.name/javascript-clone-array ]

			Meteor.call('NewRoutePoint', this._id, insertAfterId.get(), routePoint);

			// ~~~

			$('#new-point-modal').find('.trip-name').val("");
			uploadedFiles = [];
		}
	});

	Template.AddPointModal.helpers({
		'isSelected': function(){
			return this.id == insertAfterId.get();
		},
		'atLeastOnePoint': function(){
			return Trips.findOne({}).points.length > 0;
		}
	});

	// ~~~

	Template.EditPointModal.events({
		'click #edit-point': function(event){
			console.log("todo");

			/*
			var placeName = $('#edit-point-modal').find('.trip-name.selectize-control.single.selectized').val();
			
			var placeType = "normal";
			if($('#edit-point-modal').find('input[name="point-type"]:checked').length == 1)
				placeType = $('#edit-point-modal').find('input[name="point-type"]:checked').val();

			Meteor.call('EditRoutePoint', this._id, editPointId.get(), new RoutePoint(
				placeName,
				placeType
			));

			// ~~~

			$('#edit-point-modal').find('.trip-name').val("");
			editPointId.set(null);
			*/
		},
		'click #cancel-editing': function(event){
			editPointId.set(null);
		}
	});

	Template.EditPointModal.helpers({
		'editPointId': function(){
			return editPointId.get();
		}
	});

	// ~~~

	Template.ModalPointCommonContents.rendered = function(){
		var service = new google.maps.places.AutocompleteService();
		$(".trip-name").selectize({
			valueField: 'value',
			labelField: 'value',
			searchField: 'value',
			create: false,
			maxItems: 1,
			cache: false,

			render: {
				option: function(item, escape) {
					return '<div>' +
								'<span class="title">' +
									'<span class="name">' + escape(item.value) + '</span>' +
								'</span>' +
							'</div>';
				}
			},
			load: function(query, callback) {
				if(query.length > 0){
					service.getPlacePredictions({
						input: query,
						types: ["geocode"]
					}, function(predictions, status){
						if(status == google.maps.places.PlacesServiceStatus.OK){
							callback($.map(predictions, function(item){
								return { value: item.description };
							}));
						} else
							callback();
					});
				} else
				callback();
			}
		});
	};

	Template.ModalPointCommonContents.events({
		'keyup .point-waiting-time': function(event){
			$(event.currentTarget).parent().removeClass("has-error");

			if($(event.currentTarget).val().length > 0){
				try {
					juration.parse($(event.currentTarget).val());
				} catch(error){
					$(event.currentTarget).parent().addClass("has-error");
				}
			}
		}
	});

	Template.ModalPointCommonContents.helpers({
		'atLeastOnePoint': function(){
			return Trips.findOne({}).points.length > 0;
		}
	});

	// ~~~

	Template.PublishModal.events({
		'click #do-publish': function(){
			Meteor.call('PublishTrip', Trips.findOne({})._id);
		},
		'click #stop-publish': function(){
			Meteor.call('UnPublishTrip', Trips.findOne({})._id);
		}
	})
})();

/*
(function(){
	Template.NewTripModal.events({
		'click #new-trip': function(){
			var name = $("#new-trip-form .trip-name").val();
			Meteor.call('NewTrip', name, function(error, result){
				Router.go('edit-trip', { _id: result });
			});
		}
	});
})();
*/

(function(){
	Template.Dashboard.events({
		'click .trip-add-new a': function(){
			Meteor.call('NewTrip', function(error, result){
				Router.go('edit-trip', { _id: result });
			});
		}
	});

	Template.Dashboard.helpers({
		'mineTrips': function(){
			return Trips.find({ user: Meteor.userId() });
		}
	})
})();

(function(){
	var map = new RouteMapRenderer();
	var mapAffix = new RouteMapRenderer();

	var routeDirectionsPixelStep = 0;
	var routeDirections = [];

	function hoverAffixMapOn(latLng){
		mapAffix.getGoogleMap().panTo(latLng);
	}

	Template.ShowTrip.rendered = function(){
		map.initIn('map-canvas', {
			zoom: 7,
			center: new google.maps.LatLng(52.40637, 16.92517),
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			disableDefaultUI: false
		});

		map.pushRoute(PublishedTrips.findOne({}), false);

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
			}*/
		});

		/*
		google.maps.event.addListener(mapAffix.getGoogleMap(), 'idle', function(){
			// mapAffix.getGoogleMap().setCenter();
			mapAffix.getGoogleMap().setZoom(10);
			hoverAffixMapOn(routeDirections[0]);
		});
		*/
	};

	Template.ShowTrip.helpers({
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
			switch(this.type){
				case "normal":
					return '<span class="badge badge-normal-iconic"><span class="glyphicon glyphicon-map-marker"></span></span>';

				case "tent":
					return '<span class="badge badge-tent-iconic"><span class="glyphicon glyphicon-flag"></span></span>';

				case "house":
					return '<span class="badge badge-house-iconic"><span class="glyphicon glyphicon-home"></span></span>';
			}
		},
		'parseInt': function(x){
			return Math.round(x);
		},
		'logLength': function(x){
			return Math.round(100 + ((Math.log10(x) - 1) / 1.5) * 100);
		}
	});
})();

(function(){
	Template.BuyBook.events({
		'click #book_submit': function(event){
			var bookId = $("#book_id").val();
			var bookKey = $("#book_key").val();

			Meteor.call("BindBook", bookId, bookKey, function(error, result){
				if(!result)
					alert("błąd walidacji - czy na pewno podałeś odpowiedni klucz?");
				else
					alert("powiązano książeczkę");
			});
		}
	});
})();

/*
(function(){
	Template.DescriptionContents.rendered = function(){
		Uploader.finished = function(index, fileInfo, templateContext){
			console.log(fileInfo);
		};
	};
})();
*/