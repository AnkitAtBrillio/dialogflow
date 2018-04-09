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
  let city = req.body.result.parameters['geo-city'];
  let location = req.body.result.parameters['Location'];
  let locality = req.body.result.parameters['Locality'];
  console.log("locality => " + locality);

  if(locality){
      getDealersOnBasisOfLocality(locality, function(error, finalResponse){
        console.log("FinalResponse to Dialogflow " + finalResponse, error);
          //var a = finalResponse;
          res.setHeader("Content-type","application/json");
          //res.send(JSON.stringify(a));
          res.send(JSON.stringify({ 'speech': finalResponse, 'displayText': finalResponse }));
      });

  }
  if(location) {
    getDealersOnLocation(location, function(error, response){
        console.log('This is the location response ' + response);
        res.setHeader("Content-type","application/json");
        res.send(JSON.stringify({ 'speech': finalResponse, 'displayText': finalResponse }));
    });
  }
});
const port = process.env.PORT || 3001;
app.listen(port);
console.log(`Listening on port ${port}`);


function getDealersOnBasisOfLocality(locality, cb) {
  return getCoordinates(locality, cb);
  }


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

function getDealersOnLocation(location, calback){
  let dealersLocationPath = dealersPath + "&location=" + location;
  let locationPromiseResponse = getPromiseResponse(dealersHost, dealersLocationPath);
  locationPromiseResponse.then((output) => {
    if(output){
            output = JSON.parse(output);
            let totalResults =   output['totalResults'];
            finalResponse = "You have a total of " + totalResults + " dealers in " + location;
            calback(null,finalResponse);
    }
  });
}

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
