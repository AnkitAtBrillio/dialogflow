const express = require("express");
const https = require("https");
const bodyParser = require("body-parser");
const DialogflowApp = require("actions-on-google").DialogflowApp;
const geoCodeAPIURL = "maps.googleapis.com";
const geoCodeAPIKey = "AIzaSyC5VSrxufQfaSaM6J-mfFQJgGfXpiAP-7w";
const dealersHost = "digitaslbi-nonprod-stream20-qa.apigee.net";
const dealersPath = "/dialogflowdummy?size=5";
const directionsApiURL = "https://www.google.com";
const directionPath = "/maps/dir/?api=1";

var app = express();


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/getDealers', function(req,res){
  console.log("POST request accepted from dialogflow");
  console.log("Request");
  const city = req.body.result.parameters['geo-city'];
  const location = req.body.result.parameters['Location'];
  const locality = req.body.result.parameters['Locality'];
  const consent = req.body.result.parameters['Consent'];
  const services = req.body.result.parameters['Services'];
  const actualAction = req.body.result.action;

  if(locality){
      getDealersOnBasisOfLocality(locality, function(error, finalResponse){
        console.log("FinalResponse to Dialogflow " + finalResponse, error);
          //var a = finalResponse;
          res.setHeader("Content-type","application/json");
          //res.send(JSON.stringify(a));
          res.send(JSON.stringify({ 'speech': finalResponse, 'displayText': finalResponse }));
      });

  }
  if(city) {
    getDealersOnCity(city, function(error, response){
        console.log('This is the city response ' + response);
        res.setHeader("Content-type","application/json");
        res.send(JSON.stringify({ 'speech': finalResponse, 'displayText': finalResponse }));
    });
  }
  if(services){
    getServicesForDealer(req,res);
  }
  if(consent || actualAction){
  getPermissionFromUser(req,res,actualAction);
  }
});
const port = process.env.PORT || 3001;
app.listen(port);
console.log(`Listening on port ${port}`);



//Method to get dealers on basis of locality provided
function getDealersOnBasisOfLocality(locality, cb) {
  return getCoordinates(locality, cb);
  }


//Method to get corrdinates of given loclality before aking dealers call
function getCoordinates(locality, cb){

  let path="";
  let pathPrefix = "/maps/api/geocode/json?address=";
  let pathSuffix = "&key=";
  path = path + pathPrefix;
  path = path + locality;
  path = path + pathSuffix + geoCodeAPIKey;
  var coordinatesPromiseResponse = getPromiseResponse(geoCodeAPIURL, path);
  coordinatesPromiseResponse.then((output) => {
    console.log(output)
    if(output){
        console.log("coordinatesResponse => " + output);
      let response = JSON.parse(output);
      let latitude = response['results'][0]['geometry']['location']['lat'];
      let longitude = response['results'][0]['geometry']['location']['lng'];
      getDealersNearCoordindates(latitude,longitude, cb)
  }
});
}


//Method to get dealers for coordinates of given location
function getDealersNearCoordindates(latitude, longitude, cb) {

    var requestURL = dealersPath + "&lat=" +  latitude + "&long=" + longitude;
    var dealersPromiseReponse =  getPromiseResponse(dealersHost, requestURL);
    dealersPromiseReponse.then((output) => {
        console.log("dealersResponse => " + output);
      output = JSON.parse(output);
      let nearestDealer = output['dealers'][0];
      let dealerName = nearestDealer['name'];
      let distanceInKm = Math.round(nearestDealer['distance']['km']);
      let dealerLatitude = nearestDealer.geolocation.latitude;
      let dealerLongitude = nearestDealer.geolocation.longitude;
      let finalResponse = "The nearest dealer to you is " + dealerName + " which is at a distance of " + distanceInKm +  " km away";
      console.log("finalResponse => " + finalResponse);
      cb(null, finalResponse)
    });
}


//Function to get dealers on basis of city
function getDealersOnCity(city, calback){
  let dealersLocationPath = dealersPath + "&location=" + city;
  console.log("Dealres city search path " + dealersLocationPath);
  let locationPromiseResponse = getPromiseResponse(dealersHost, dealersLocationPath);
  locationPromiseResponse.then((output) => {
    if(output){
                  console.log("This is city search response " + output);
            output = JSON.parse(output);
            let totalResults =   output['totalResults'];
            finalResponse = "You have a total of " + totalResults + " dealers in " + city + ". Would you like to locate nearest dealer or in a particular area?";
            calback(null,finalResponse);
    }
  });
}

function getCorrdinatesOfNearestDealer(latiude,longitude,cb) {

    var requestURL = dealersPath + "&lat=" +  latiude + "&long=" + longitude;
    var dealersPromiseReponse =  getPromiseResponse(dealersHost, requestURL);
    dealersPromiseReponse.then((output) => {
        console.log("dealersResponse => " + output);
      output = JSON.parse(output);
      let nearestDealer = output['dealers'][0];
      let distanceInKm = Math.round(nearestDealer['distance']['km']);
      let dealerLatitude = nearestDealer.geolocation.latitude;
      let dealerLongitude = nearestDealer.geolocation.longitude;
      let finalResponse = {"latitude" : dealerLatitude, "longitude" : dealerLongitude};
      console.log("finalResponse => " + finalResponse);
      cb(null, finalResponse)
    });
}


//Generic function to handle http request and response
function getPromiseResponse(host, path) {
  return new Promise((resolve,reject) => {
      https.get({host : host, path : path}, (res) => {
        let body = "";
        res.on('data', (d) => {body+=d;});
        res.on('end', () => {
          resolve(body);
        });
        res.on("error", (error) => {
            console.log("Error occured is => " + error);
          reject(error);
        });
      });
  });
}


//Generic method to handle operations to start navigation to nearest dealer
function getPermissionFromUser(request,response,actualAction) {

  console.log("Inside getPermissionFromUser");
  console.log("Request body " + JSON.stringify(request.body));
  const permissionAction = "request_permission";
  const user_info_action = "user_info";
  const navigation_action = "start_navigation";
  const app = new DialogflowApp({request,response});
  let  userStorage = app.userStorage;


  console.log(`actualAction ${actualAction}`);

  if(actualAction == permissionAction){
    console.log("Getting permission");
      return app.askForPermission("To locate you ", app.SupportedPermissions.DEVICE_PRECISE_LOCATION); 
  }
  if(actualAction == user_info_action){
      if(app.isPermissionGranted()){
        let latitude = request.body.originalRequest.data.device.location.coordinates.latitude;
        let longitude = request.body.originalRequest.data.device.location.coordinates.longitude;
        userStorage.userLatitude = latitude;
        userStorage.userLongitude = longitude;
        let finalResponse = "We have located you, would you like to start navigation to nearest dealer or would you like to check for services?";
         response.setHeader("Content-type","application/json");
          //res.send(JSON.stringify(a));
          response.send(JSON.stringify({ 'speech': finalResponse, 'displayText': finalResponse }));
      }
    } 

    if(actualAction == navigation_action){
        let userStorageData = request.body.originalRequest.data.user.userStorage;
        if(userStorageData){
          userStorageData = JSON.parse(userStorageData);
          let latitude = userStorageData.data.userLatitude;
          let longitude = userStorageData.data.userLongitude
          getCorrdinatesOfNearestDealer(latitude,longitude,function(error, finalResponse){
            if(error) {
              let errorResponse = "there seem to be some problem in starting the navigation. Try again later";
              response.setHeader("Content-type","application/json");
              response.send(JSON.stringify({ 'speech': errorResponse, 'displayText': errorResponse }));
            }
              let dealerLatitude = finalResponse.latitude;
              let dealerLongitude = finalResponse.longitude;
              callGoogleNavigationAPI(app, latitude, longitude, dealerLatitude, dealerLongitude);

          });
        }

    }
}


//Function to start navigation from google api call
function callGoogleNavigationAPI(dialogFlowApp, userLatitude, userLongitude, dealerLatitude, dealerLongitude) {

  let path = directionPath + "&amp;origin=" + userLatitude + "," + userLongitude + "&amp;destination=" + dealerLatitude + "," + dealerLongitude + "&amp;key=" + geoCodeAPIKey;
    console.log("Directions url " + path);
    const finalDirectionsURL = directionsApiURL + path;
    let screenCapibility = dialogFlowApp.SurfaceCapabilities.SCREEN_OUTPUT;
    console.log("Does device has screen capability " + dialogFlowApp.hasSurfaceCapability(screenCapibility));
    if(!dialogFlowApp.hasSurfaceCapability(screenCapibility)){
      return dialogFlowApp.ask('Sorry this feature is available only for devices with screen');
    }


  return dialogFlowApp.tell(dialogFlowApp.buildRichResponse().addSimpleResponse("Here are the directions").addBasicCard(dialogFlowApp.buildBasicCard().setImage("https://koenig-media.raywenderlich.com/uploads/2018/01/GoogleMaps-feature-2.png", "Directions").addButton("Start", finalDirectionsURL)));
  
}


//Function to get services provided by nearest dealers
function getServicesForNearestDealer(req,res){




}




function getServicesForDealer(dealerID){

  let dealerIdPath = "/" + dealerID;
  let indexOfQueryParam = dealersPath.indexOf("?");
  let individualDealerPath = [dealersPath.slice(indexOfQueryParam),dealerIdPath,dealersPath.slice(indexOfQueryParam)].join('');
  console.log("individualDealerPath " + individualDealerPath);
  let individualDealerResponse = getPromiseResponse(dealersHost, individualDealerPath);
  individualDealerResponse.then((output) => {
      console.log("Individual Dealers "  + JSON.stringify(output));
  });

}
