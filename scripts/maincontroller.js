app.controller("MainController", function ($scope, $route, $window) {

    $scope.csvFile = null;
    $scope.canGeocode = false;
    $scope.data = {};
    $scope.dataCount = 0;
    $scope.delay = 100;
    $scope.index = 0;
    $scope.forceRefresh = false;

    $scope.init = function () {
        if (sessionStorage['geocode_data'] && sessionStorage['geocode_index']) {
            $scope.data = JSON.parse(sessionStorage['geocode_data']);
            sessionStorage.removeItem(['geocode_data']);

            $scope.dataCount = $scope.countData();

            $scope.index = sessionStorage['geocode_index'];
            sessionStorage.removeItem(['geocode_index']);

            $scope.updateProgress();
            $scope.geocodeNext();
        }
    };

    window.onbeforeunload = function (event) {
        if (!$scope.forceRefresh) {
            sessionStorage.removeItem(['geocode_data']);
            sessionStorage.removeItem(['geocode_index']);
        }
    };

    $(function () {
        $('#geocode-file').change(function () {
            var fileName = $(this).val();
            $scope.canGeocode = fileName != "" ? true : false;
            $scope.$apply();
        });
    });

    $scope.submitCsvUpload = function () {
        $scope.data = $.csv.toObjects($scope.csvFile);
        $scope.getLatLonForBatch();
    };

    $scope.getLatLonForBatch = function () {
        $scope.delay = 100;
        $scope.index = 0;
        $scope.dataCount = $scope.countData();
        $scope.geocodeNext();
    };

    $scope.countData = function () {
        var count = 0;
        for (var row in $scope.data) {
            count++;
        }
        return count;
    };

    $scope.geocodeNext = function () {

        var address = $scope.constructAddress($scope.constructAddressArray());

        if (address === "") {
            $scope.index++;
            if ($scope.index < $scope.dataCount) {
                $scope.geocodeNext();
            } else {
                $scope.finishGeocoding();
            }
            return;
        }

        // This delay results in fewer requests to the Google geocding service but makes
        // little, if any, difference to the time it takes for the results to come through
        setTimeout(function () {
        $scope.geocodeUsingGoogle(address);
        }, /*600*/ 200);
    };

    $scope.constructAddressArray = function () {
        var addressArr = [
            $scope.data[$scope.index]['TradingName'],
            $scope.data[$scope.index]['Address1'],
            $scope.data[$scope.index]['Address2'],
            $scope.data[$scope.index]['Address3'],
            $scope.data[$scope.index]['Address4'],
            $scope.data[$scope.index]['County'],
            $scope.data[$scope.index]['PostCode']
        ];
        return addressArr;
    };

    $scope.constructAddress = function (addressArr) {
        var address = "";
        var firstVal = true;
        for (var i = 0; i < addressArr.length; i++) {
            if (addressArr[i] != undefined && addressArr[i] != null && addressArr[i] != "") {
                if (firstVal) {
                    address += addressArr[i];
                    firstVal = false;
                } else {
                    address += "," + addressArr[i];
                }
            }
        }
        return address;
    };

    $scope.geocodeUsingGoogle = function (address) {
        geocoder.geocode({ 'address': address, 'componentRestrictions': { 'country': "GB" } }, $scope.makeCallback(address));
        $("script[src*='maps.googleapis.com / maps / api / js / QuotaService.RecordEvent']").remove();
    };

    $scope.moveToNextInput = function () {
        if ($scope.index < $scope.data.length - 1) {
            $scope.index++;
            if ($scope.delay > 0) {
                $scope.delay -= 100;
            }
            $scope.geocodeNext();
        } else {
            $scope.finishGeocoding();
        }
    }

    $scope.makeCallback = function (address) {
        var geocodeCallBack = function (results, status) {
            if (results && results[0]) {
                // Success
                var result = results[0];
                $scope.data[$scope.index]['Latitude'] = result.geometry.location.lat().toFixed(7);
                $scope.data[$scope.index]['Longitude'] = result.geometry.location.lng().toFixed(7);
                console.log($scope.data[$scope.index]);
            } else if (status === google.maps.GeocoderStatus.OK || status === google.maps.GeocoderStatus.ZERO_RESULTS) {
                // Failure
                var dataClone = JSON.parse(JSON.stringify($scope.data[$scope.index]));
                $scope.locationErrorData.push(dataClone);
                // This deletion can take place even though we are iterating as we are
                // iterating through a json object rather than a json array
                delete $scope.data[$scope.index];
                console.log("Failed: " + $scope.index);
            }

            if (status !== google.maps.GeocoderStatus.OK && status !== google.maps.GeocoderStatus.ZERO_RESULTS) {
                // probably an intermittent failure, try again
                $scope.delay += 100;
                console.log("Delay is: " + $scope.delay + " Increased as a result of: " + status);
                if ($scope.delay < 200 || !sessionStorage) {
                    setTimeout(function () {
                        $scope.geocodeNext();
                    }, $scope.delay);
                }
                else {
                    $scope.forceRefresh = true;
                    sessionStorage['geocode_data'] = JSON.stringify($scope.data);
                    sessionStorage['geocode_index'] = $scope.index;
                    $window.location.reload();
                }
            } else {
                $scope.moveToNextInput();
            }
        }
        $scope.updateProgress();
        return geocodeCallBack;
    }

    $scope.finishGeocoding = function () {
        console.log("Finished");
        $('#geocode-progress').html("100%");
        sessionStorage.removeItem(['geocode_data']);
        sessionStorage.removeItem(['geocode_index']);
        $scope.canGeocode = true;
        $scope.$apply();
    }

    $scope.updateProgress = function () {
        var pc = parseInt($scope.index / $scope.dataCount * 100);
        $('#geocode-progress').html(pc + "%");
        $scope.$apply;
    }

}).directive("fileread", [function () {
    return {
        scope: {
            fileread: "="
        },
        link: function (scope, element, attributes) {
            element.bind("change", function (changeEvent) {
                var reader = new FileReader();
                if (changeEvent.target.files.length < 1) {
                    scope.fileread = null;
                    return;
                }
                reader.readAsText(changeEvent.target.files[0]);
                reader.onload = function (loadEvent) {
                    scope.$apply(function () {
                        scope.fileread = loadEvent.target.result;
                    });
                }
            });
        }
    }
}]);