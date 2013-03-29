(function() {

    var PROBLEMS_URL = './data/DistributomeGame_ProblemExamples_Nov_2012.csv';
    var DISTRIBUTIONS_URL = './data/Distributome.xml';
    /**
     * Downloads data in XML or CSV. Sends it to Core in JSON.
     */
    var DataDownloader = (function() {

        var getRawData = function(url, eventName) {

            var dataFormat = (url.indexOf('xml') > -1) ? 'xml' : 'text';

            $.ajax({
                url: url,
				async: true,
				cache: false,
                dataType: dataFormat,
				success: function(data) {
                    returnJSON(data, eventName, dataFormat);
                },
                error: function(data, text) {
                    console.log('Load wasn\'t performed:' + text);
                    // TODO: show modal window with the error
                }
            });
        }

        var getProblemsData = function() {
            getRawData(PROBLEMS_URL, 'problems_loaded');
        }

        var getDistributionsData = function() {
            getRawData(DISTRIBUTIONS_URL, 'distributions_loaded');
        }

        var parseDistributomeXml = function(xml) {

            var distributions;

            function isDistributionNode(node) {
                return (node.nodeType == 1 && node.nodeName && node.nodeName.toLowerCase() == 'distribution');
            }

            function isNameOrDescription(node) {
                return (node.nodeType == 1 &&
                    (node.nodeName.toLowerCase() == 'name' || node.nodeName.toLowerCase() == 'model'));
            }

            function getDistributionInfo(node) {

                var distributionInfo = { name: '', description: ''};

                var infoNodes = [];
                for(var j = 0; j < node.childNodes.length; j++)
                    if(isNameOrDescription(node.childNodes[j]))
                        infoNodes.push(node.childNodes[j]);

                var last = infoNodes.length - 1;
                distributionInfo.name = (infoNodes[0].nodeName == 'name') ? infoNodes[0].childNodes[0].nodeValue : '';
                distributionInfo.description = (infoNodes[last].nodeName == 'model') ? infoNodes[last].childNodes[0].nodeValue : '';

                return distributionInfo;
            }

            if(xml) {

                for (i = 0; i < xml.length; i++) {
                    if(xml[i].nodeType == 1 && xml[i].nodeName.toLowerCase() == 'distributions') {

                        var distributionNodes = [];
                        for(var j = 0; j < xml[i].childNodes.length; j++)
                            if(isDistributionNode(xml[i].childNodes[j]))
                                distributionNodes.push(xml[i].childNodes[j]);

                        distributions = distributionNodes.map(getDistributionInfo);
                    }
                }

                return distributions;

            } else {
                console.log("Can't load Distributome.xml");
                // TODO: show error modal window
                return false;
            }
        }

        var csvToJson = function ( strData, strDelimiter ){
            // Check to see if the delimiter is defined. If not,
            // then default to comma.
            strDelimiter = (strDelimiter || ",");

            // Create a regular expression to parse the CSV values.
            var objPattern = new RegExp(
                (
                    // Delimiters.
                    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +

                        // Quoted fields.
                        "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +

                        // Standard fields.
                        "([^\"\\" + strDelimiter + "\\r\\n]*))"
                    ),
                "gi"
            );


            // Create an array to hold our data. Give the array
            // a default empty first row.
            var arrData = [[]];

            // Create an array to hold our individual pattern
            // matching groups.
            var arrMatches = null;


            // Keep looping over the regular expression matches
            // until we can no longer find a match.
            while (arrMatches = objPattern.exec( strData )){

                // Get the delimiter that was found.
                var strMatchedDelimiter = arrMatches[ 1 ];

                // Check to see if the given delimiter has a length
                // (is not the start of string) and if it matches
                // field delimiter. If id does not, then we know
                // that this delimiter is a row delimiter.
                if (
                    strMatchedDelimiter.length &&
                        (strMatchedDelimiter != strDelimiter)
                    ){

                    // Since we have reached a new row of data,
                    // add an empty row to our data array.
                    arrData.push( [] );

                }


                // Now that we have our delimiter out of the way,
                // let's check to see which kind of value we
                // captured (quoted or unquoted).
                if (arrMatches[ 2 ]){

                    // We found a quoted value. When we capture
                    // this value, unescape any double quotes.
                    var strMatchedValue = arrMatches[ 2 ].replace(
                        new RegExp( "\"\"", "g" ),
                        "\""
                    );

                } else {

                    // We found a non-quoted value.
                    var strMatchedValue = arrMatches[ 3 ];

                }


                // Now that we have our value string, let's add
                // it to the data array.
                arrData[ arrData.length - 1 ].push( strMatchedValue );
            }

            // Return the parsed data.
            return( arrData );
        }

        var xmlToJson = function(data) {
            return convertXMLToJSON(data);
        }

        var returnJSON = function(data, eventName, format) {
            var parsedData;
            if(format == 'text')
                parsedData = d3.csv.parse(data);
            else if(eventName == 'distributions_loaded')
                parsedData = parseDistributomeXml(data.documentElement.childNodes);
            else
                parsedData = xmlToJson(data);

            Core.fireEvent({
                msg : eventName,
                data : parsedData
            });
        };

        return {
            getProblemsData : getProblemsData,
            getDistributionsData: getDistributionsData
        }
    })();

    /**
     * Takes data in JSON and prepares data to rendering.
     */
    var DataProcessor = (function() {

        var fisherYatesShuffle = function(myArray) {
            var i = myArray.length;
            var initialPositions = d3.range(0, i);
            if ( i == 0 ) return false;
            while ( --i ) {
                var j = Math.floor( Math.random() * ( i + 1 ) );
                var temp = myArray[i];
                myArray[i] = myArray[j];
                myArray[j] = temp;
            }
            return myArray
        };

        var isProblem = function(problem) {
            return (problem['ProblemTitle'] && problem['ProblemTitle'] != '' &&
                problem['distribution'] && problem['distribution'] != '' &&
                problem['ProblemUID'] && problem['ProblemUID'] != '');
        };

        var getDistribution = function(problem) { return problem['distribution']; };

        var getDistributionDescription = function(problem) { return 'Distribution Description' };

        var getProblemInfo = function(problem) {
            return {
                name : problem['ProblemTitle'],
                description: problem['Description'],
                distribution: problem['distribution'],
                hint: problem['hint'],
                comment: problem['comment']
            }
        };

        var prepareDataForGraph = function(problemsData, distributionsData) {

            var filteredData = problemsData.filter(isProblem);
            var distributions = fisherYatesShuffle(distributionsData);
            var problems = filteredData.map(getProblemInfo);

            sendDataToCore({
                problems : problems,
                distributions: distributions
            });
        };

        var sendDataToCore = function(data) {
            Core.fireEvent({
                msg : 'prepared',
                data: data
            });
        };

        return {
            prepareDataForGraph : prepareDataForGraph
        }
    })();

    /**
     * Renders data.
     */
    var DataRenderer = (function() {

        var svg;    // graph area element

        var DEFAULT_WIDTH = 500;
        var DEFAULT_HEIGHT = 300;

        var width = DEFAULT_WIDTH;
        var height = DEFAULT_HEIGHT;
        var margins = 20;

        var problems;
        var distributions;
        var guessingMap = [];
        var problemsNumber;
        var distributionsNumber;

        // TODO: make a custom function instead of changing String
        jQuery.extend (String.prototype, {
            camelize: function() {
                return this.replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
                    return letter.toUpperCase();
                }).replace(/\s+/g, '');
            }
        });

        var init = function(data) {

//			if (problemsSize > data.problems.length) //Fix problems size
//			{
//			   problemsSize = data.problems.length;
//			   console.log("Problem size too large");
//                // TODO: show modal window ?
//			}
//			else if (problemsSize <= 0)
//			{
//			   problemsSize = 1;
//			   console.log("Problem size must be positive");
//                // TODO: show modal window ?
//			}
			
//			$('#num').attr('value',problemsSize); //set control panel
//			$('#num').attr('max',data.problems.length); //Set max problem size in HTML
//			if (simplify == 'true')           //set checkbox
//			    $('#simp').prop('checked',true);
//			else
//			    $('#simp').prop('checked',false);
				
//			var temp = data.problems.length - problemsSize;
			problems = data.problems;
//			for (i=0;i<temp;i++) //shrink problems length to problem size
//			    problems.pop();
			
            distributions = data.distributions;
            problemsNumber = problems.length;
            distributionsNumber = distributions.length;

            prepareGuessingMap();
			
//            if ($('#simp').prop('checked'))
//			    shrinkDistributions(); //shrink distributions

//            adjustViewport(margins);
//            originalWidth = width; //hyz2

            $('.modal-hint-control').on('click', function() { $('.modal-body-hint').slideToggle();});
            $('#game').on('click', function () { return false; });
            $('#instructions').on('click', function() {
                showInstructions();
                return false;
            });

            createGraph();
            addControlsListeners();
        }

        var createGraph = function() {

            removeGraph();

            adjustViewport();
            $('.slopegraph').width(width).height(height);

            svg = d3.select('#slopegraph').append('svg')
                .attr('width', width)
                .attr('height', height);

            renderCartesian();
        }

        // Clean graph area before redrawing
        var removeGraph = function() {
            svg = d3.select('#slopegraph svg');
            svg.on('click', null);
            svg.on('mousemove', null);

            $('#slopegraph').empty();
        }

        var adjustViewport = function() {

            var viewportWidth = $(window).width() - 2 * margins;
            var viewportHeight = $(window).height() - 2 * margins - $('.header').height() - $('.descriptions').height();

            width = Math.max(DEFAULT_WIDTH, viewportWidth);
            height = Math.max(DEFAULT_HEIGHT, viewportHeight);
        }

        var prepareGuessingMap = function() {
            var distributionNames = distributions.map(function(distr) {
                return distr.name.toLowerCase()
                    .replace('distribution', '')
                    .replace(/[^a-z]/g,'');
            });

            for(var i = 0; i < problemsNumber; i++) {
                guessingMap[i] = jQuery.inArray(problems[i].distribution.toLowerCase().replace(/[^a-z]/g,''), distributionNames);
            } 
        }
		
//		var shrinkDistributions = function() {
//
//			if (problemsNumber > distributionsSize)
//			    return;
//
//            var neededDistribution = [];
//			for (i=0;i<distributionsNumber;i++)
//                neededDistribution[i] = 0;
//
//			for (j=0;j<problemsNumber;j++)  //Creating hashing array to store correct distributions
//			{
//			  neededDistribution[guessingMap[j]] = 1;
//			}
//			var i = 0;
//			while (i <= distributionsNumber - distributionsSize)  //Shrinking distributions by randomly delete incorrect distributions
//			{
//			  rand = Math.floor(Math.random()*(distributionsNumber + 1));
//			  if (neededDistribution[rand] !=1 && distributions[rand] != 'none')
//			  {
//			    distributions[rand] = 'none';
//				i++;
//			  }
//			  rand++;
//			}
//
//			var i = distributions.indexOf('none');
//			while (i != -1)
//			{
//			  distributions.splice(i,1);
//			  i = distributions.indexOf('none');
//			}
//
//		    distributionsNumber = distributions.length;  //Rerendering
//            prepareGuessingMap();
//		}

        function coord(line, axis) {
            return line[axis + '1']['baseVal']['value'];
        }

        var showInstructions = function () {
            var instructionsModal = $('#instructions-modal');
            instructionsModal.modal('show');
        }

        var getCrossAreaByIndices = function (xLine, yLine, xIndex, yIndex) {

            var xLeft = (xIndex == 0) ? 0 : coord(xLine[0][xIndex - 1], 'x');
            var xRight = (xIndex == xLine[0].length) ? width : coord(xLine[0][xIndex], 'x');
            var currDistribLabel = distributions[xIndex - 1].name;

            var yUp = (yIndex == 0) ? 0 : coord(yLine[0][yIndex - 1], 'y');
            var yDown = (yIndex == yLine[0].length) ? height : coord(yLine[0][yIndex], 'y');
            var currProblemLabel = problems[yIndex - 1].name;

            return {
                column: {
                    xLeft: xLeft,
                    xRight: xRight,
                    index: xIndex - 1,
                    label: currDistribLabel
                },
                row: {
                    yUp: yUp,
                    yDown: yDown,
                    index: yIndex - 1,
                    label: currProblemLabel
                }
            }
        }

        var getIndicesByCoordinate = function(xLine, yLine, xCoord, yCoord) {

            var columns = xLine[0].map(function(line) { return coord(line, 'x') });
            var rows = yLine[0].map(function(line) { return coord(line, 'y') });

            var xIndex = d3.bisectLeft(columns, xCoord);
            var yIndex = d3.bisectLeft(rows, yCoord);

            return ({
                xIndex: (xIndex != 0) ? xIndex : 1,
                yIndex: (yIndex != 0) ? yIndex : 1
            });
        }

        var setLabelsPos = function(xMouse, yMouse) {

            // Offset from mouse pointer
            var offset = 20;

            var distribLabel = svg.select('.distribution');
            var distribLabelWidth = distribLabel.node().getBBox().width;
            var distribLabelX = (yMouse > height / 2) ? (- yMouse + 1.5 * offset) : (- yMouse - distribLabelWidth - 1.5 * offset);
            var distribLabelY = (xMouse > width / 2) ? (xMouse) : (xMouse + offset);

            var problemLabel = svg.select('.problem');
            var problemLabelWidth = problemLabel.node().getBBox().width;
            var problemLabelX = (xMouse > width / 2) ? (xMouse - problemLabelWidth - 1.5 * offset) : (xMouse + 1.5 * offset);
            var problemLabelY = (yMouse > height / 2) ? (yMouse) : (yMouse + offset);

            distribLabel.transition()
                .ease('linear')
                .delay(0)
                .duration(10)
                .attr('x', distribLabelX)
                .attr('y', distribLabelY)
                .attr('transform', 'rotate(-90)');

            problemLabel.transition()
                .ease('linear')
                .delay(0)
                .duration(10)
                .attr('x', problemLabelX)
                .attr('y', problemLabelY);
        }

        var updateLabels = function(columnLabel, rowLabel) {

            svg.select('.distribution')
                .text(columnLabel)
                .attr('transform', 'rotate(-90)')

            svg.select('.problem')
                .text(rowLabel)

        }

        var updateHighlighting = function(xLine, yLine, xMouse, yMouse) {
            var indices = getIndicesByCoordinate(xLine, yLine, xMouse, yMouse);
            var area = getCrossAreaByIndices(xLine, yLine, indices.xIndex, indices.yIndex);
            highlight(area);
            setLabelsPos(xMouse, yMouse);
			updateGuessRect(xLine, yLine);
			////////////////hyz////////////
//			updateScoreRect(xLine,yLine);
			///////////////////////////////
        }

        var updateDescriptions = function(distributionIndex, problemIndex) {
            $('#problemDescription').text(problems[problemIndex].description);
            $('#distributionDescription').text(distributions[distributionIndex].description);
        }

        var highlight = function(area) {

            svg.select('.highlight.column')
                .transition()
                .ease('linear')
                .delay(0)
                .duration(20)
                .attr('x', area.column.xLeft)
                .attr('y', 0)
                .attr('width', area.column.xRight - area.column.xLeft)
                .attr('height', height);

            svg.select('.highlight.row')
                .transition()
                .ease('linear')
                .delay(0)
                .duration(20)
                .attr('x', 0)
                .attr('y', area.row.yUp)
                .attr('width', width)
                .attr('height', area.row.yDown - area.row.yUp);

            updateLabels(area.column.label, area.row.label);
            updateDescriptions(area.column.index, area.row.index);
        };

        var updateGuessRect = function(xLine, yLine) {
            var currGuess = svg.select('.guess');
            var xIndex = currGuess.attr('xIndex');
            var yIndex = currGuess.attr('yIndex');

            if(xIndex && yIndex && (currGuess.attr('width') != 0) && (currGuess.attr('height') != 0)) {
                var classList = currGuess.attr('class');
                var cross = getCrossAreaByIndices(xLine, yLine, parseInt(xIndex) + 1, parseInt(yIndex) + 1);

                var guessRect = {
                    x: cross.column.xLeft,
                    y: cross.row.yUp,
                    width: (cross.column.xRight - cross.column.xLeft),
                    height: (cross.row.yDown - cross.row.yUp),
                    class: classList,
                    xIndex: cross.column.index,
                    yIndex: cross.row.index
                };
                renderGuessRect(guessRect);
            }
        };
/////////////////////////////////////////////////update score///////////////////////////////////////
//        var updateScoreRect = function(xLine, yLine) {
//
//			lastColumn = getCrossAreaByIndices(xLine, yLine, distributionsNumber, 1).column.xRight; //mod
//			for (i=1;i<=problemsNumber;i++)
//			{
//			    var currScore = svg.select('.score');
//				var cross = getCrossAreaByIndices(xLine, yLine, distributionsNumber, i);
//                var classList = currScore.attr('class');
//                var scoreRect = {
//                    x: width,
//                    y: cross.row.yUp,
//                    width: (cross.column.xRight - cross.column.xLeft),
//                    height: (cross.row.yDown - cross.row.yUp),
//                    class: classList,
//                    xIndex: cross.column.index,
//                    yIndex: cross.row.index,
//					yMid: (cross.row.yDown + cross.row.yUp)/2
//                };
//                renderScoreRect(scoreRect);
//			}
//        };

        var isRightGuess = function(xIndex, yIndex) {
            return (guessingMap[yIndex] == xIndex);
        };

//        // TODO: what the f*** it's doing here?
//        var wrongGuess = 0; //used to count the number of wrong guesses
//		var wrongGuessList = [];
//        var rightGuessList = [];
//
//		for(var i = 0; i <= 100; i++) {
//		   wrongGuessList[i] = 0;
//		   rightGuessList[i] = 0;
//		}
//        var currentRow = -1; //hyz

		var showGuessRect = function(xLine, yLine, indices) {

            var cross = getCrossAreaByIndices(xLine, yLine, indices.xIndex, indices.yIndex);
		
            var isRight = isRightGuess(cross.column.index, cross.row.index);	
			if (!isRight)  //count number of wrong guess
            {
			  if (currentRow == -1)
			    currentRow = cross.row.index;  //hyz
			  wrongGuess++;
			  wrongGuessList[cross.row.index]++;
			}
	        else
			{  
			  currentRow = -1; //hyz
			  wrongGuess = 0;
			  wrongGuessList[cross.row.index] = 0;
			  rightGuessList[cross.row.index] = 1;
			}
			//--------------------------------------------------------------
            var guessRect = {
                x: cross.column.xLeft,
                y: cross.row.yUp,
                width: (cross.column.xRight - cross.column.xLeft),
                height: (cross.row.yDown - cross.row.yUp),
                class: (isRight) ? 'guess right' : 'guess wrong',
                xIndex: cross.column.index,
                yIndex: cross.row.index
            }; 
            renderGuessRect(guessRect);
			
			var app = 'Number of wrong guesses: ' + wrongGuess; //display number of wrong guesses
			if (wrongGuess == 1)
			{    
			    $('.modal-body-wrong').append('<p id="wrongGuessNum"></p>');
				$('#wrongGuessNum').text(app);
			}
			else
                $('#wrongGuessNum').text(app);

		};

        var hideGuessRect = function() {
            svg.select('.guess').attr('class', 'guess')
                .attr('width', 0)
                .attr('height', 0);
        }

        var guess = function(xLine, yLine, mouse) {

            var xMouse = mouse[0] || 0;
            var yMouse = mouse[1] || 0;

            temp = getCrossAreaByIndices(xLine, yLine, distributionsNumber, 1).column.xRight; //hyz boundry condition
            if (xMouse >= temp) return -1; // hyz

            var guessClassList = svg.select('.guess').attr('class');
            var indices = getIndicesByCoordinate(xLine, yLine, xMouse, yMouse);
			

            // select cell, if nothing is selected
            if(guessClassList.indexOf('wrong') == -1 && guessClassList.indexOf('right') == -1) {
                showGuessRect(xLine, yLine, indices);
            } else {
                var currXIndex = svg.select('.guess').attr('xIndex');
                var currYIndex = svg.select('.guess').attr('yIndex');

                // show modal if the same cell is clicked
                if ((indices.xIndex - 1) == currXIndex && (indices.yIndex - 1) == currYIndex) {
                    showGuessModal(indices.xIndex - 1, indices.yIndex - 1);
                // select another cell
                } else {
                    hideGuessRect();
                    showGuessRect(xLine, yLine, indices);
                }
            }
        }

        var showGuessModal = function(xIndex, yIndex) {

            var guessModal = $('#guess-modal');
            guessModal.modal('show');

            var isRight = ($('.guess').attr('class').indexOf('right') > -1);

            $('.modal-body-comment').text((isRight && problems[yIndex].comment != '') ? 'Comment: ' + problems[yIndex].comment : '');
            $('.modal-body-hint').text((!isRight) ? 'Hint: ' + problems[yIndex].hint : '');

            var distrName = distributions[xIndex].name
                .toLowerCase()
                .replace('distribution', '')
                .camelize()
                .replace(/[^a-zA-Z]/g,'');

            $('.link-calc').attr('href', './calc/' + distrName + 'Calculator.html');
            $('.link-exp').attr('href', './exp/' + distrName + 'Experiment.html');
            $('.link-sim').attr('href', './sim/' + distrName + 'Simulation.html');

            $('.modal-header-right').toggle(isRight);
            $('.modal-body-right').toggle(isRight);
            $('.modal-body-comment').toggle(isRight);
            $('.modal-header-wrong').toggle(!isRight);
            $('.modal-body-wrong').toggle(!isRight);
            $('.modal-hint-control').toggle(!isRight);

            $('.modal-body-hint').hide();
        }

        var renderGuessRect = function(rect) {
            svg.select('.guess')
                .transition()
                .ease('linear')
                .delay(0)
                .duration(0)
                .attr('class', rect.class)
                .attr('x', rect.x)
                .attr('y', rect.y)
                .attr('width', rect.width)
                .attr('height', rect.height)
                .attr('xIndex', rect.xIndex)
                .attr('yIndex', rect.yIndex);
        };

        var renderScoreRect = function(rect) {
			id = '#ScoreRect'+rect.yIndex.toString();
            svg.select(id)
                .transition()
                .ease('linear')
                .delay(0)
                .duration(0)
                .attr('x', rect.x)
                .attr('y', rect.y)
                .attr('width',  scoreWidth)
                .attr('height', rect.height)
                .attr('xIndex', rect.xIndex)
                .attr('yIndex', rect.yIndex); 

			if (wrongGuessList[rect.yIndex] != 0)
			    svg.select(id).attr('class','scoreWrong');
			else if (rightGuessList[rect.yIndex] == 1)
			    svg.select(id).attr('class','scoreRight');
			else
			    svg.select(id).attr('class','score');
				
			id = '#Score'+rect.yIndex.toString();
			$(id)		
			    .attr('x', rect.x)
				.attr('y', rect.yMid)//rect.y+15)
				.text(wrongGuessList[rect.yIndex])
        };		

        var redraw = function(xLine, yLine, xFisheye, yFisheye, xM, yM) {

            var xMouse = xM || 0;
            var yMouse = yM || 0;
            xLine.attr("x1", xFisheye).attr("x2", xFisheye);
            yLine.attr("y1", yFisheye).attr("y2", yFisheye);

//            if (originalWidth != width + scoreWidth)  //check if the browser is zoomed, hardcoded so far
//			{
//              if (width - originalWidth >5)
//			    window.location.reload(true);
//
//			  adjustViewport(20);
//			  originalWidth = width;
//			  renderCartesian();
//			}
            
			updateHighlighting(xLine, yLine, xMouse, yMouse);
        }

        var renderCartesian = function() {
//            // TODO: what da f*** is 54?
//			scoreWidth = width/54;
//			width -= scoreWidth; //hyz

            var offset = 0;
            var xSteps = d3.range(offset, width, (width - offset) / distributionsNumber );
            var ySteps = d3.range(offset, height, (height - offset) / problemsNumber);

            var xFisheye = d3.fisheye.scale(d3.scale.identity).domain([0, width]).focus(360),
                yFisheye = d3.fisheye.scale(d3.scale.identity).domain([0, height]).focus(90);

            svg.append("g")
                .attr("transform", "translate(-.5,-.5)");

            svg.append("rect")
                .attr("class", "background")
                .attr("width", width)
                .attr("height", height);

            svg.insert('rect', 'background')
                .attr('class', 'highlight column')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0);

            svg.insert('rect', 'background')
                .attr('class', 'highlight row')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0);

            svg.append('rect')
                .attr('class', 'guess')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0);
				
	//////////////////////////////////////Create Score Object////////////////	    
//			// TODO: what the f*** is going on here? why 100???
//			for (i=0;i<=100;i++)
//			{
//			  var id = 'Score' + i.toString();
//			  var id2 = 'ScoreRect' + i.toString();
//
//              svg.append('rect')
//                  .attr('id', id2)
//				  .attr('class', 'score')
//                  .attr('x', 0)
//                  .attr('y', 0)
//                  .attr('width', 0)
//                  .attr('height', 0);
//
//			  svg.append('text')
//			      .attr('id',id)
//			      .attr('class', 'scoreText')
//				  .attr('x', 0)
//				  .attr('y', 0);
//			}

            svg.append('text')
                .attr('class', 'distribution pointer-text')
                .attr('x', 0)
                .attr('y', 0);

            svg.append('text')
                .attr('class', 'problem pointer-text')
                .attr('x', 0)
                .attr('y', 0);

            var xLine = svg.selectAll(".x")
                .data(xSteps)
                .enter().append("line")
                .attr("class", "x")
                .attr("y2", height);

            var yLine = svg.selectAll(".y")
                .data(ySteps)
                .enter().append("line")
                .attr("class", "y")
                .attr("x2", width);

            redraw(xLine, yLine, xFisheye, yFisheye);
            addGraphListeners(xLine, yLine, xFisheye, yFisheye);
        }

        var isProblemNumValid = function(newProblemNum) {
            var numberOnly = /^\d+$/;
            return (numberOnly.test(newProblemNum) &&
                parseInt(newProblemNum) > 0 &&
                parseInt(newProblemNum) <= problems.length)
        };

        var updateProblemNum = function(newProblemNum) {

            if(isProblemNumValid(newProblemNum)) {
                problemsNumber = newProblemNum;
                createGraph();
            } else {
                $('#problemNum').tooltip('show');
                setTimeout(function() {
                    $('#problemNum').tooltip('hide');
                }, 3000);
            }
        };

        // Set listeners to object outside graph
        var addControlsListeners = function() {

            var waitForInputStop = (function() {

                var typeOut;

                function clearTimer() {
                    if (typeOut) {
                        clearTimeout(typeOut);
                    }
                }

                function startTimer(obj) {
                    clearTimer(obj);

                    typeOut = setTimeout(function () {
                        // TODO: recreate graph with new number of problems
                        updateProblemNum(obj.val());
                    }, 500);
                }

                return {
                    clearTimer: clearTimer,
                    startTimer: startTimer
                }
            })();

            var waitForFinalEvent = (function () {
                var timers = {};
                return function (callback, ms, uniqueId) {
                    if (!uniqueId) {
                        uniqueId = "Don't call this twice without a uniqueId";
                    }
                    if (timers[uniqueId]) {
                        clearTimeout (timers[uniqueId]);
                    }
                    timers[uniqueId] = setTimeout(callback, ms);
                };
            })();

            $(window).resize(function() {
                waitForFinalEvent(function() {
                    createGraph();
                }, 500, "some unique string");
            });

            $('#problemNum')
                .keydown(waitForInputStop.clearTimer)
                .keyup(function() { waitForInputStop.startTimer($(this)); })
                .focus()
                .tooltip({
                    'selector': '',
                    'delay': { show: 500, hide: 100 },
                    'title': 'Enter number from 1 to ' + problems.length
                });
        };

        // Set listeners to objects inside graph
        var addGraphListeners = function(xLine, yLine, xFisheye, yFisheye) {

            svg.on("mousemove", function() {
//                var temp = getCrossAreaByIndices(xLine, yLine, distributionsNumber, 1).column.xRight; //mod
				var mouse = d3.mouse(this);
//                if (mouse[0] > temp) mouse[0] = temp; //fixmouse

                xFisheye.focus(mouse[0]);
                yFisheye.focus(mouse[1]);
                redraw(xLine, yLine, xFisheye, yFisheye, mouse[0], mouse[1]);
            });

            svg.on('click', function() {
                console.log('click');
                var mouse = d3.mouse(this);
                guess(xLine, yLine, mouse);
            });
        };

        return {
            renderData: init
        }
    })();

    /**
     * Core module. Controls others.
     */
    var Core = (function() {

        var problems;
        var distributions;

        /**
         * Process events from other modules.
         * @public
         * @param event
         */
        var api = function(event) {

            if(!event || !event.msg || !event.data)
                return false;

            switch(event.msg) {
                case 'problems_loaded' :
                    problems = event.data;
                    processData();
                    break;

                case 'distributions_loaded' :
                    distributions = event.data;
                    processData();
                    break;

                case 'prepared':
                    renderData(event.data);
                    break;

                default:
                    console.log('Callback was not mapped.');
                    break;
            }

            return 0;
        };

        var init = function() {
            if(window.d3) {

                getData();

            } else {
                var slopegraph = document.getElementById('slopegraph');
                if(slopegraph)
                    slopegraph.innerHTML = '<h1>D3js cannot bo loaded. Check Internet connection.</h1>';
                else
                    console.log('There is no container for graphics in html. It should have class .slopegraph');
            }
        };

        var getData = function() {

            problems = null;
            distributions = null;

            DataDownloader.getDistributionsData();
            DataDownloader.getProblemsData();
        };

        var processData = function() {
            if(problems && distributions)
                DataProcessor.prepareDataForGraph(problems, distributions);
        };

        var renderData = function(data) {
            DataRenderer.renderData(data);
        };

        return {
            init : init,
            fireEvent : api
        }
    })();

    return { start : Core.init() }
} ());
