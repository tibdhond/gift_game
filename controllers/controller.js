const os = require( 'os' );
const fs = require('fs');
const path = require('path');
const serveIndex = require('serve-index');
let address = "https://present-game.herokuapp.com";


let state = {
    people: {},
    votes: {},
    voted: 0,
    gifts: [],
    complete: false,
    round: -1,
    rounds: [],
    finished: false
};

let rm_pc = false;
let self_vote = true;

let error = "";

// Check if server has registered
let server = false;

// Websocket stuff
let hostSocket = undefined;
let connects = [];

const gifs = ["banana", "ferret", "spongebob", "koala", "dog", "turtle", "unicorn", "computer", "parrot", "minecraft"];

class Gift {
    constructor(description, obj) {
        if (obj) {
            obj && Object.assign(this, obj);
        } else {
            this.description = description;
            this.owner = undefined;
        }
    }

    setOwner(owner) {
        this.owner = owner;
    }
}

class Player {
    constructor(name, obj) {
        if (obj) {
            obj && Object.assign(this, obj);
        } else {
            this.name = name;
            this.round = -1;
            this.playing = true;
            this.notcurrent = true;
            this.rounds = [];
            this.right = 0;
            this.my_votes = 0;
        }
    }
}

exports.host_socket = function(ws, req) {
    hostSocket = ws;
    connects.forEach(socket => {
        socket.send("finished")
    });
    ws.on('close', () => {
        console.log("Closing host");
        hostSocket = undefined;
    });
};

exports.newSocket = function(ws, req) {
    connects.push(ws);
    console.log(`Amount of websockets: ${connects.length}`);
    ws.on('close', () => {
        connects = connects.filter(conn => {
            return (conn !== ws);
        });
    });
};

exports.home = function(req, res) {
    res.redirect("/login");
};

exports.login = function (req, res) {
    console.log("Cookies: " + JSON.stringify(req.cookies));
    if('id' in req.cookies) {
        if (!(req.cookies["id"] in state.people)) {
            state.people[req.cookies["id"]] = new Player(req.cookies["id"]);
            if (hostSocket === undefined || hostSocket.readyState === 3 || hostSocket.readyState === 2) {
                res.render("client_views/host_not_ready", {message: "De host is nog niet klaar, gelieve even te wachten."});
                return;
            }
            else {
                hostSocket.send("new person");
            }
        }
        res.redirect("/waiting_room");
    }
    else {
        res.render("client_views/login.pug", {taken: false, nick: ""});
    }
};

exports.newPerson = function (req, res) {
    let name = 'id' in req.cookies ? req.cookies["id"] : req.body.Name.toString();
    if (!(name in state.people)) {
        state.people[name] = new Player(name);
        state.votes[name] = 0;
        if (hostSocket === undefined || hostSocket.readyState === 3 || hostSocket.readyState === 2) {
            res.render("client_views/host_not_ready", {message: "De host is nog niet klaar, gelieve even te wachten."});
            return;
        }
        else {
            hostSocket.send("new person");
        }
        res.cookie("id", req.body.Name.toString(), {maxAge : 24 * 3600000}).redirect("/waiting_room"); // 2 days
    }
    else {
        if ('id' in req.cookies) {
            res.redirect("/waiting_room");
        }
        res.render("client_views/login.pug", {taken: true, nick: req.body.Name.toString()})
    }
};

exports.person_list = function (req, res) {
    if(!server) {
        res.cookie("server", true, {maxAge : 24 * 3600000}).render("host_views/persons.pug",
            {
                ip: address,
                persons: state.people
            }
        );
        server = true;
    }
    else if("server" in req.cookies) {
        res.render("host_views/persons.pug", {ip: address, persons: state.people})
    }
    else {
        res.redirect("/");
    }
};

exports.start = function (req, res) {
    console.log("Settings: " + JSON.stringify(req.body));
    rm_pc = req.body.rm_pc !== undefined;
    self_vote = req.body.self_vote !== undefined;
    if(req.body.load !== undefined) {
        let oldState = undefined;
        fs.readFile("gameState.json", (err, data) => {
            if(err) throw err; oldState = data;
            // console.log(`Old state: ${oldState}`);
            state = JSON.parse(oldState);
            state.rounds = state.rounds.map(e => new Gift(null, e));
            for (const [key, value] of Object.entries(state.people)) {
                state.people[key] = new Player(null, value);
            }
            // console.log(`New state: ${state}`);
            res.redirect("/gift")
        });
    }
    else {
        res.redirect("/gift")
    }
};

exports.person_delete = function(req, res) {
    delete state.people[req.body.person];
    delete state.votes[req.body.person];
    res.redirect("/" + req.params.origin);
};

exports.next_gift = function (req, res) {
    // console.log(state.gifts);
    // console.log(state.rounds);
    // console.log(state.round);
    console.log(state.complete);
    if (!server) {
        res.redirect("/people");
    }
    else {
        fs.writeFile("gameState.json", JSON.stringify(state), err => {if(err) throw err});
        if (state.complete && (state.rounds.length === state.round + 1)) { // All gifts are known
            if (state.gifts.length > 0) {  // Pick a random gift
                console.log(`Gifts: ${state.gifts}`);
                let index = 0;
                if (state.gifts.length > 1) {
                    let z = (2 / (state.gifts.length - 1)) / state.gifts.length;    // Custom distribution where smaller numbers have higher chance
                    while(index >= state.gifts.length - 1) {
                        index = state.gifts.length - 1 - (Math.floor(1 / 2 + Math.sqrt(8 * Math.random() + z) / (2 * Math.sqrt(z))));
                    }
                }
                state.rounds.push(state.gifts[index]);  // Set gift to be used in current round
                console.log(`next gift: ${state.rounds[state.rounds.length-1]}`);
                state.gifts.splice(index, 1); // Presents in use are removed from list
                res.render("host_views/next.pug", {gift: state.rounds[state.round + 1].description.toString(), complete: state.complete});
            } else {  // Game has ended
                res.redirect("/host_result");
            }
        } else {  // Should only be called on a refresh (gift already selected)
            console.log('second if');
            if (!state.complete || state.rounds[state.round+1]) {
                res.render("host_views/next.pug", {
                    gift: state.rounds.length === state.round + 1 ? "" : state.rounds[state.round+1].description.toString(),
                    complete: state.complete
                });
            } else {
                res.redirect("/host_result");
            }
        }
    }
};

exports.new_gift = function (req, res) {
    if(req.body.gift !== '') {
        state.rounds.push(new Gift(req.body.gift));
        state.complete = state.complete || req.body.rTrue !== undefined;
    }
    else {
        if(req.body.rTrue !== undefined) {
            state.complete = true;
        }
    }

    state.voted = 0;

    if (state.round === 0) {
        for (let person_key in state.people) {
            if (state.people.hasOwnProperty(person_key) && person_key !== undefined)
                state.votes[person_key] = 0;
        }
    }
    else {
        for(let person_key in state.votes) {
            if(state.votes.hasOwnProperty(person_key) && person_key) {
                state.votes[person_key] = 0;
            }
        }
    }

    state.round += 1;
    console.log(state.votes);

    res.redirect("/host_wait");
};

exports.reset = function (req, res) {

    state.voted = 0;
    error = "";

    for (let person_key in state.people) {
        if (state.people.hasOwnProperty(person_key)) {
            state.people[person_key].round = state.round - 1;
        }
    }

    if (state.round === 0) {
        for (let person_key in state.people) {
            if (state.people.hasOwnProperty(person_key) && person_key !== undefined)
                state.votes[person_key] = 0;
        }
    }
    else {
        for(let person_key in state.votes) {
            if(state.votes.hasOwnProperty(person_key) && person_key) {
                state.votes[person_key] = 0;
            }
        }
    }

    res.redirect("/host_wait");
};

exports.host_wait = function (req, res) {
    if (!server) {
        res.redirect("/people");
        return;
    }

    connects.forEach(socket => {
        socket.send("finished")
    });
    if (state.voted === Object.keys(state.people).length) {
        if (state.rounds[state.round].owner === undefined && error === "") {
            error = "Niemand heeft het cadeau opgeëist, de ronde begint opnieuw."
        }

        if (error !== "") {
            res.redirect("/invalid");
        } else {
            state.gifts.push(state.rounds[state.round]);
            res.redirect("/scoreboard");
        }
        return;
    }
    console.log(`rounds length: ${state.rounds.length}, current round ${state.round}`);

    res.render("host_views/host_wait.pug", {
        voted: state.voted,
        length: Object.keys(state.people).length,
        ratio: "" + (Math.floor(state.voted * 100 / Object.keys(state.people).length)) + "%",
        gift: state.rounds[state.round].description.toString()
    });
};

exports.scoreboard = function (req, res) {
    if(!server) {
        res.redirect("/people");
    }
    else {
        let length = Object.keys(state.people).length;
        res.render("host_views/scoreboard.pug", {votes: state.votes, people: state.people, rm_pc: rm_pc,
                                        length: self_vote ? length : length - 1});
    }
};

exports.wait = function (req, res) {
    if(!("id" in req.cookies)) {
        res.redirect("/login");
    }
    else {
        if (!(req.cookies["id"] in state.people)) {
            state.people[req.cookies["id"]] = new Player(req.cookies["id"]);
            state.votes[req.cookies["id"]] = 0;
            if (hostSocket === undefined) {
                res.render("client_views/host_not_ready", {message: "De host is nog niet klaar, gelieve even te wachten."});
                return;
            }
            else {
                hostSocket.send("new person");
            }
        }
        if(state.people[req.cookies["id"]].round !== state.round) {
            res.redirect("/vote");
        }
        else if (state.finished) {
            res.redirect("/client_result");
        }
        else {
            let gif = gifs[Math.floor(Math.random() * gifs.length)];
            res.render("client_views/client_wait.pug", {image: `images/${gif}.gif`});
        }
    }
};

exports.vote_get = function (req, res) {
    if (hostSocket === undefined || hostSocket.readyState === 3 || hostSocket.readyState === 2) {
        res.render("client_views/host_not_ready", {message: "De host is nog niet klaar, gelieve even te wachten."});
        return;
    }
    else {
        console.log(`Hostsocket status is ${hostSocket.readyState}`)
    }
    if(!("id" in req.cookies)) {    // Person hasn't logged in yet
        res.redirect("/login");
    }
    else {
        if (!(req.cookies["id"] in state.people)) { // Player is not yet registered with server
            state.people[req.cookies["id"]] = new Player(req.cookies["id"]);
            state.votes[req.cookies["id"]] = 0;
        }
        if(state.people[req.cookies["id"]].round >= state.round) {  // Player has already voted
            state.people[req.cookies["id"]].round = state.round;
            res.redirect("/waiting_room");
        }
        else {
            state.people[req.cookies["id"]].notcurrent = false;
            res.render("client_views/vote_screen", {persons: state.people, id: req.params.id,
                gift: state.rounds[state.round].description, rm_pc: rm_pc});
            state.people[req.cookies["id"]].notcurrent = true;
        }
    }
};

exports.vote_post = function (req, res) {
    if(!("id" in req.cookies)) {        // Person has not logged in yet
        res.redirect("/login");
    }
    else {      // Person has logged in
        if (!(req.cookies["id"] in state.people)) {   // Person has logged in but server forgot
            state.people[req.cookies["id"]] = new Player(req.cookies["id"]);
            state.votes[req.cookies["id"]] = 0;
        }
        if (state.people[req.cookies["id"]].round >= state.round) {     // Person is not allowed to vote (yet)
            state.people[req.cookies["id"]].round = state.round;
            res.redirect("/waiting_room");
        }
        else {      // Person is allowed to vote
            if (req.body.person.toString() === "Mijn cadeau") {        // Person has claimed the gift
                if(state.rounds[state.round].owner !== undefined && state.rounds[state.round].owner !== req.cookies["id"]) {    // gift already claimed
                    error = "Meerdere mensen hebben het cadeau opgeëist, de ronde begint opnieuw.";
                    // Errors can only be handled at the end of the round
                    state.rounds[state.round].owner = undefined;
                }
                else {  // gift claimed successfully
                    state.rounds[state.round].setOwner(req.cookies["id"]);
                    if(self_vote) { // Don't show self vote in scoreboard
                        state.votes[req.cookies["id"]] += 1;
                    }
                    if(state.people[req.cookies["id"]].rounds.length === state.round+1) {
                        // last round was invalid and has restarted; existing gift may be invalid
                        state.people[req.cookies["id"]].rounds[state.round] = req.body.person;
                    }
                    else {  // no problems
                        state.people[req.cookies["id"]].rounds.push(req.body.person);
                    }
                }
            }
            else if (req.body.person in state.votes) {    // successful vote
                state.votes[req.body.person] += 1;
                if(state.people[req.cookies["id"]].rounds.length === state.round+1) {
                    // last round was invalid and has restarted; existing gift may be invalid
                    state.people[req.cookies["id"]].rounds[state.round] = req.body.person;
                }
                else {  // no problems
                    state.people[req.cookies["id"]].rounds.push(req.body.person);
                }
            }
            else {  // person not found, should not happen
                console.log(state.votes);
                console.log(req.body.person.toString());
                console.log(typeof req.body.person.toString());
                throw new Error();
            }
            state.voted += 1;
            state.people[req.cookies["id"]].round = state.round;
            hostSocket.send("" + (Math.floor(state.voted * 100 / Object.keys(state.people).length)) + "%");
            res.redirect("/waiting_room");
        }
    }
};

exports.nocache = function(req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next();
};

exports.has_gift = function (req, res) {
    state.people[req.body.person].playing = false;
    state.gifts.pop();
    res.redirect("/gift")
};

exports.invalid = function (req, res) {
    res.render("host_views/Invalid_round", {error: error})
};

exports.host_result = function(req, res) {

    // Uncomment for testing
    // for (let i=0; i < 10; i++) {
    //     state.people["person"+i] = new Player("person"+i);
    //     state.people["person"+i].right = Math.floor(Math.random() * 50);
    //     state.people["person"+i].my_votes = Math.floor(Math.random() * 5);
    // }


    for(let key in state.people) {
        if (state.people.hasOwnProperty(key)) {
            for (let i = 0; i < state.rounds.length; i++) {
                let person = state.people[key];
                if (person.rounds[i] === state.rounds[i].owner) {
                    console.log(person.rounds[i]);
                    console.log(state.rounds[i].owner);
                    state.people[key].right++;
                }
                else if (person.rounds[i] === "Mijn cadeau") {
                    state.people[key].my_votes++;
                }
            }
        }
    }

    state.finished = true;

    connects.forEach(socket => {
        socket.send("finished")
    });

    res.render("host_views/result_host", {people: Object.values(state.people).sort(function(a, b){return b.right - a.right})});
};

exports.client_result = function(req, res) {
    res.render("client_views/result_client", {rounds: state.rounds, person: state.people[req.cookies["id"]]});
};

exports.images = function(req, res) {
    res.render("host_views/images", {images: fs.readdirSync('public/presentImages')});
}
