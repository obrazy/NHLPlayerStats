﻿// For an introduction to the Blank template, see the following documentation:
// http://go.microsoft.com/fwlink/?LinkID=397704
// To debug code on page load in Ripple or on Android devices/emulators: launch your app, set breakpoints, 
// and then run "window.location.reload()" in the JavaScript Console.
(function () {
	"use strict";

	////////// CORDOVA
	document.addEventListener('deviceready', onDeviceReady.bind(this), false);

	function onDeviceReady() {
		// Handle the Cordova pause and resume events
		document.addEventListener('pause', onPause.bind(this), false);
		document.addEventListener('resume', onResume.bind(this), false);

		// TODO: Cordova has been loaded. Perform any initialization that requires Cordova here.
		initializeData();
	};

	function onPause() {
		// TODO: This application has been suspended. Save application state here.
	};

	function onResume() {
		// TODO: This application has been reactivated. Restore application state here.
	};
	////////// ...CORDOVA

	////////// Constants and definitions
	var stats = {
		name: {
			label: "name",
			column: 1,
			comparer: compareNames,
			sortingComparer: undefined
		},
		team: {
			label: "team",
			column: 2,
			comparer: undefined,
			sortingComparer: undefined
		},
		pos: {
			label: "pos",
			column: 3,
			comparer: undefined,
			sortingComparer: undefined
		},
		gamesPlayed: {
			label: "gamesPlayed",
			column: 4,
			comparer: undefined,
			sortingComparer: undefined
		},
		goals: {
			label: "goals",
			column: 5,
			comparer: compareGoals,
			sortingComparer: goalsSortingComparer
		},
		assists: {
			label: "assists",
			column: 6,
			comparer: compareAssists,
			sortingComparer: assistsSortingComparer
		},
		points: {
			label: "points",
			column: 7,
			comparer: comparePoints,
			sortingComparer: pointsSortingComparer
		},
		plusMinus: {
			label: "plusMinus",
			column: 8,
			comparer: comparePlusMinus,
			sortingComparer: undefined
		},
		avgTime: {
			label: "avgTime",
			column: 21,
			comparer: undefined,
			sortingComparer: undefined
		}
	};

	var teamToId = {
		anaheim: "2",
		arizona: "29",
		boston: "7",
		buffalo: "8",
		calgary: "22",
		caroline: "13",
		chicago: "17",
		colorado: "23",
		colombus: "18",
		dallas: "27",
		detroit: "19",
		edmonton: "24",
		florida: "14",
		losAngeles: "28",
		minnesota: "25",
		montreal: "9",
		nashville: "20",
		newJersey: "3",
		newYorkI: "4",
		newYorkR: "5",
		ottawa: "10",
		philadelphia: "1",
		pittsburgh: "6",
		sanJose: "30",
		stLouis: "21",
		tampaBay: "15",
		toronto: "11",
		vancouver: "26",
		washington: "16",
		winnipeg: "12"
	};

	var urlHelper = {
		getStatsUrl: function (page) {
			return this.baseUrl +
				this.statAttDefault + "&" +
				this.sortAttDefault + "&" +
				this.pageLabel + page + "&" +
				this.searchAttDefault + "&" +
				this.tabsAttDefault + "&" +
				this.teamAttDefault + "&" +
				this.positionAttDefault;
		},

		baseUrl: "http://www.rds.ca/hockey/lnh/statistiques?",
		pageLabel: "pageIndex=",
		statAttDefault: "sort_col=points",
		teamAttDefault: "teamFilter=all",
		positionAttDefault: "positionFilter=all",
		sortAttDefault: "sort_order=desc",
		searchAttDefault: "searchString=",
		tabsAttDefault: "tabs_index=2",

		getImgSrc: function (teamId) {
			return this.imgSrcPrefix + teamId + this.imgSrcSuffix;
		},

		imgSrcPrefix: "http://rdsmedia.cookieless.ca/sports/hockey/nhl/team/35x17/",
		imgSrcSuffix: ".png"
	};

	var positions = {
		all: "all",
		d: "D"
	};

	var tables = [
		{
			id: "points_all",
			stat: stats.points,
			pos: positions.all
		},
		{
			id: "goals_all",
			stat: stats.goals,
			pos: positions.all
		},
		{
			id: "assists_all",
			stat: stats.assists,
			pos: positions.all
		},
		{
			id: "points_d",
			stat: stats.points,
			pos: positions.d
		},
		{
			id: "goals_d",
			stat: stats.goals,
			pos: positions.d
		},
		{
			id: "assists_d",
			stat: stats.assists,
			pos: positions.d
		}
	];

	function NhlPlayer(name, team, pos, gamesPlayed, goals, assists, plusMinus, avgTime) {
		this.name = name;
		this.team = parseInt(team);
		this.pos = pos;
		this.gamesPlayed = parseInt(gamesPlayed);
		this.goals = parseInt(goals);
		this.assists = parseInt(assists);
		this.points = this.goals + this.assists;
		this.plusMinus = parseInt(plusMinus);
		this.avgTime = getSecondsFromAvgTime(avgTime);
	}

	// RDS Constants
	var pagesToFetch = 4; // Fetch only 4 pages of stats
	var playersPerPage = 50;
	// ...RDS Constants

	var playersPerTable = 10;
	var selectedTeam = teamToId.montreal;
	var statsFileName = "stats.dat";
	var statsCacheDuration = 60 * 1000 * 60; // 60 minutes

	var pagesDownloaded = 0;
	var players = new Array();
	var statsFileEntry;
	////////// ...Constants and definitions

	////////// Helper functions
	function fileErrorHandler(e) {
		console.log(e.code);
	};

	function initializeData() {
		window.requestFileSystem(LocalFileSystem.PERSISTENT, 2 * 1024 * 1024, gotFileSystem, fileErrorHandler);
	};

	function gotFileSystem(fs) {
		fs.root.getFile(statsFileName, { create: true, exclusive: false }, gotFileEntry, fileErrorHandler);
	};

	function gotFileEntry(fe) {
		statsFileEntry = fe;
		fe.file(gotFile, fileErrorHandler);
	};

	function gotFile(f) {
		var reader = new FileReader();
		reader.onloadend = function (e) {
			loadStats(this.result);
		};
		reader.readAsText(f);
	};

	function loadStats(fileContent) {
		var lines = fileContent.split("\n");
		if (newDataNeeded(lines[0])) {
			loadFromWeb();
		} else {
			loadFromFile(lines);
		}
	};

	function newDataNeeded(fileHeader) {
		var lastUpdate = new Date(fileHeader);
		var now = new Date();

		if (lastUpdate.toString() === "Invalid Date" || now - lastUpdate > statsCacheDuration) {
			return true;
		}

		return false;
	};

	function loadFromFile(lines) {

		displayStats();
	};

	function loadFromWeb() {
		for (var i = 0; i < pagesToFetch; i++) {
			var url = urlHelper.getStatsUrl(i);
			httpGet(url, extractStats);
		}
	};

	function getTeamFromImgSrc(imgSrc) {
		var lengthToExtract = imgSrc.length - (urlHelper.imgSrcPrefix.length + urlHelper.imgSrcSuffix.length);
		return imgSrc.substr(urlHelper.imgSrcPrefix.length, lengthToExtract);
	};

	function getSecondsFromAvgTime(avgTimeStr) {
		var time = avgTimeStr.split(":");
		return time[0] * 60 + time[1];
	};

	function httpGet(url, callback) {
		var xmlhttp;
		if (window.XMLHttpRequest) {
			xmlhttp = new XMLHttpRequest();
		}

		xmlhttp.onreadystatechange = function () {
			if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
				callback(xmlhttp.responseText);
			}
		};

		xmlhttp.open("GET", url, true);
		xmlhttp.send();
	};

	function extractStats(htmlContent) {
		var newPlayers = new Array(playersPerPage);
		var count = 0;
		$(htmlContent).find(".table.stats tbody tr").each(function (index, value) {
			var name = $(this).find("td:nth-child(" + stats.name.column + ")").text();
			var team = getTeamFromImgSrc($(this).find("img").attr("src"));
			var pos = $(this).find("td:nth-child(" + stats.pos.column + ")").text();
			var gamesPlayed = $(this).find("td:nth-child(" + stats.gamesPlayed.column + ")").text();
			var goals = $(this).find("td:nth-child(" + stats.goals.column + ")").text();
			var assists = $(this).find("td:nth-child(" + stats.assists.column + ")").text();
			var plusMinus = $(this).find("td:nth-child(" + stats.plusMinus.column + ")").text();
			var avgTime = $(this).find("td:nth-child(" + stats.avgTime.column + ")").text();

			newPlayers[count] = new NhlPlayer(name, team, pos, gamesPlayed, goals, assists, plusMinus, avgTime);
			count++;
		});

		Array.prototype.push.apply(players, newPlayers);

		pagesDownloaded++;
		if (pagesDownloaded == pagesToFetch) {
			updateStatsFile();
			displayStats();
		}
	};

	function displayStats() {
		var defensemen = players.filter(function (x) { return x.pos == "D" });

		for (var i = 0; i < tables.length; i++) {
			var relevantPlayers = tables[i].pos === positions.d ? defensemen : players;
			relevantPlayers.sort(stats[tables[i].stat.label].sortingComparer);
			$("#" + tables[i].id + " > .spinner").toggleClass("hidden");
			createTable(tables[i].id, tables[i].stat, relevantPlayers);
		}
	};

	function updateStatsFile() {
		statsFileEntry.createWriter(function (fileWriter) {
			var linesToWrite = new Array(players.length + 2);
			fileWriter.seek(0);
			var now = new Date().toString();
			for (var i = 1; i < players.length; i++) {
				if (true) {
					var dsadsa = 5;
				}
			}
		}, fileErrorHandler);
	};

	function createTable(tableId, stat, relevantPlayers) {
		var tableDiv = document.getElementById(tableId);
		var table = document.createElement("TABLE");
		tableDiv.appendChild(table);
		var tBody = document.createElement("TBODY");
		table.appendChild(tBody);

		var currentRank = 0;
		var currentIndex = 0;

		for (; currentIndex < playersPerTable; currentIndex++) {
			var tr = document.createElement("TR");
			tBody.appendChild(tr);

			var td = document.createElement("TD");
			var nextRank = getRank(currentRank, currentIndex, stat, relevantPlayers);
			if (nextRank !== currentRank) {
				td.appendChild(document.createTextNode(nextRank));
				currentRank = nextRank;
			}
			tr.appendChild(td);

			td = document.createElement("TD");
			var img = document.createElement("IMG");
			img.src = urlHelper.getImgSrc(relevantPlayers[currentIndex].team);
			td.appendChild(img);
			tr.appendChild(td);

			td = document.createElement("TD");
			td.appendChild(document.createTextNode(relevantPlayers[currentIndex].name));
			tr.appendChild(td);

			td = document.createElement("TD");
			td.appendChild(document.createTextNode(relevantPlayers[currentIndex][stat.label]));
			tr.appendChild(td);
		}
	};

	function getRank(currentRank, currentIndex, stat, relevantPlayers) {
		if (currentIndex === 0) {
			return 1;
		}

		if (stat.comparer(relevantPlayers[currentIndex], relevantPlayers[currentIndex - 1]) === 0) {
			return currentRank;
		}

		return currentIndex + 1;
	};

	// Comparers
	function pointsSortingComparer(p1, p2) {
		var cmp = comparePoints(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		cmp = compareGoals(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		return compareBase(p1, p2);
	};

	function goalsSortingComparer(p1, p2) {
		var cmp = compareGoals(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		cmp = comparePoints(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		return compareBase(p1, p2);
	};

	function assistsSortingComparer(p1, p2) {
		var cmp = compareAssists(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		cmp = comparePoints(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		return compareBase(p1, p2);
	};

	function comparePoints(p1, p2) {
		return p2.points - p1.points;
	};

	function compareGoals(p1, p2) {
		return p2.goals - p1.goals;
	};

	function compareAssists(p1, p2) {
		return p2.assists - p1.assists;
	};

	function comparePPS(p1, p2) {
		var pps1 = p1.points / (p1.gamesPlayed * p1.avgTime);
		var pps2 = p2.points / (p2.gamesPlayed * p2.avgTime);
		if (pps1 > pps2) {
			return -1;
		} else if (pps1 < pps2) {
			return 1;
		} else {
			return 0;
		}
	};

	function comparePlusMinus(p1, p2) {
		return p2.plusMinus - p1.plusMinus;
	};

	function compareNames(p1, p2) {
		if (p1.name > p2.name) {
			return 1;
		} else if (p1.name < p2.name) {
			return -1;
		} else {
			return 0;
		}
	};

	function compareBase(p1, p2) {
		var cmp = comparePPS(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		cmp = comparePlusMinus(p1, p2);
		if (cmp !== 0) {
			return cmp;
		}

		return compareNames(p1, p2);
	};
	// ...Comparers
	////////// ...Helper functions
})();