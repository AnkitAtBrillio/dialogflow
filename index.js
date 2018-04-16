const express = require("express");
const https = require("https");
const bodyParser = require("body-parser");
const geoCodeAPIURL = "maps.googleapis.com";
const geoCodeAPIKey = "AIzaSyC5VSrxufQfaSaM6J-mfFQJgGfXpiAP-7w";
const dealersHost = "ankitsrivastava-test.apigee.net";
const dealersPath = "/stubdealersapi?size=5";

var app = express();


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/getDealers', function(req,res){
  console.log("POST request accepted from dialogflow");
  const city = req.body.result.parameters['geo-city'];
  const location = req.body.result.parameters['Location'];
  const locality = req.body.result.parameters['Locality'];
  const consent = req.body.result.parameters['Consent'];
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


function getPermissionFromUser(request,response,actualAction) {

  console.log("Inside getPermissionFromUser");
  console.log("Request body " + JSON.stringify(request.body));
  const permissionAction = "request_permission";
  const user_info_action = "user_info";
  const navigation_action = "start_navigation";
  const DialogflowApp = require("actions-on-google").DialogflowApp;
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
        return app.tell("We have located you woulongitude;ld you like to start navigation to nearest dealer?");
      }
    } 

    if(actualAction == navigation_action){
        let retainedLat = userStorage.latitude;
        let retainedLong = userStorage.longitude;
        console.log("retainedLat " + retainedLat);
        console.log("retainedLong " + retainedLong);
    }
}
