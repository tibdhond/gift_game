let people = {};

let votes = {};
let voted = 0;
let gifts = [];
let complete = false;
let round = -1;
let error = "";
let server = false;
let rounds = [];
let finished = false;
let hostSocket = undefined;
let connects = [];

class Gift {
    constructor(description) {
        this.description = description;
        this.owner = undefined;
    }

    setOwner(owner) {
        this.owner = owner;
    }
}

class Player {
    constructor(name) {
        this.name = name;
        this.round = -1;
        this.playing = true;
        this.notcurrent = true;
        this.rounds = [];
        this.right = 0;
    }
}

exports.host_socket = function(ws, req) {
    hostSocket = ws;
};

exports.newSocket = function(ws, req) {
    connects.push(ws);
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
    if('id' in req.cookies) {
        if (!(req.cookies["id"] in people)) {
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
            hostSocket.send("new person");
        }
        res.redirect("/waiting_room");
    }
    else {
        res.render("client_views/login.pug", {taken: false, nick: ""});
    }
};

exports.newPerson = function (req, res) {
    if (!(req.body.Name.toString() in people)) {
        people[req.body.Name.toString()] = new Player(req.body.Name.toString());
        votes[req.body.Name.toString()] = 0;
        hostSocket.send("new person");
        res.cookie("id", req.body.Name.toString(), {maxAge : 24 * 3600000}).redirect("/waiting_room"); // 2 days
    }
    else {
        res.render("client_views/login.pug", {taken: true, nick: req.body.Name.toString()})
    }
};

exports.person_list = function (req, res) {
    if(!server) {
        res.cookie("server", true, {maxAge : 24 * 3600000}).render("host_views/persons.pug", {persons: people});
        server = true;
    }
    else if("server" in req.cookies) {
        res.render("host_views/persons.pug", {persons: people})
    }
    else {
        res.redirect("/");
    }
};

exports.person_delete = function(req, res) {
    delete people[req.body.person];
    delete votes[req.body.person];
    res.redirect("/" + req.params.origin);
};

exports.next_gift = function (req, res) {
    console.log(gifts);
    console.log(rounds);
    console.log(round);
    console.log(complete);
    if (Object.keys(people).length === 0) {
        res.redirect("/people");
    }
    else {
        if (complete && rounds.length === round + 1) { // All gifts are known
            if (gifts.length > 0) {  // Pick a random gift
                let index = 0;
                if (gifts.length > 1) {
                    let z = (2 / (gifts.length - 1)) / gifts.length;    // Custom distribution where smaller numbers have higher chance
                    index = gifts.length - 1 - (Math.floor(1 / 2 + Math.sqrt(8 * Math.random() + z) / (2 * Math.sqrt(z))));
                }
                rounds.push(gifts[index]);  // Set gift to be used in current round
                gifts.splice(index, 1); // Presents in use are removed from list
                res.render("host_views/next.pug", {gift: rounds[round + 1].description.toString(), complete: complete});
            } else {  // Game has ended
                res.redirect("/host_result");
            }
        } else {  // Should only be called on a refresh (gift already selected)
            res.render("host_views/next.pug", {
                gift: rounds.length === round + 1 ? "" : rounds[round].description.toString(),
                complete: complete
            });
        }
    }
};

exports.new_gift = function (req, res) {
    if(!complete) {
        rounds.push(new Gift(req.body.gift));
    }

    complete = complete || req.body.rTrue !== undefined;

    voted = 0;

    if (round === 0) {
        for (let person_key in people) {
            if (people.hasOwnProperty(person_key) && person_key !== undefined)
                votes[person_key] = 0;
        }
    }
    else {
        for(let person_key in votes) {
            if(votes.hasOwnProperty(person_key) && person_key) {
                votes[person_key] = 0;
            }
        }
    }

    round += 1;
    connects.forEach(socket => {
        socket.send("finished")
    });
    console.log(votes);

    res.redirect("/host_wait");
};

exports.reset = function (req, res) {

    voted = 0;
    error = "";

    for (let person_key in people) {
        if (people.hasOwnProperty(person_key)) {
            people[person_key].round = round - 1;
        }
    }

    if (round === 0) {
        for (let person_key in people) {
            if (people.hasOwnProperty(person_key) && person_key !== undefined)
                votes[person_key] = 0;
        }
    }
    else {
        for(let person_key in votes) {
            if(votes.hasOwnProperty(person_key) && person_key) {
                votes[person_key] = 0;
            }
        }
    }

    res.redirect("/host_wait");
};

exports.host_wait = function (req, res) {
    if (Object.keys(people).length === 0) {
        res.redirect("/people");
    }
    else {
        if (voted === Object.keys(people).length) {
            if (rounds[round].owner === undefined && error === "") {
                error = "Niemand heeft het cadeau opgeëist, de ronde begint opnieuw."
            }

            if (error !== "") {
                res.redirect("/invalid");
            } else {
                gifts.push(rounds[round]);
                res.redirect("/scoreboard");
            }
        } else {
            res.render("host_views/host_wait.pug", {
                voted: voted,
                length: Object.keys(people).length,
                ratio: "" + (Math.floor(voted * 100 / Object.keys(people).length)) + "%",
                gift: rounds[round].description
            });
        }
    }
};

exports.scoreboard = function (req, res) {
    res.render("host_views/scoreboard.pug", {votes: votes, length: Object.keys(people).length});
};

exports.wait = function (req, res) {
    if(!("id" in req.cookies)) {
        res.redirect("/login");
    }
    else {
        if (!(req.cookies["id"] in people)) {
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
            votes[req.cookies["id"]] = 0;
            hostSocket.send("new person");
        }
        if(people[req.cookies["id"]].round !== round) {
            res.redirect("/vote");
        }
        else if (finished) {
            res.redirect("/client_result");
        }
        else {
            res.render("client_views/client_wait.pug");
        }
    }
};

exports.vote_get = function (req, res) {
    if(!("id" in req.cookies)) {
        res.redirect("/login");
    }
    else {
        if (!(req.cookies["id"] in people)) {
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
            votes[req.cookies["id"]] = 0;
        }
        if(people[req.cookies["id"]].round >= round) {
            people[req.cookies["id"]].round = round;
            res.redirect("/waiting_room");
        }
        else {
            people[req.cookies["id"]].notcurrent = false;
            res.render("client_views/vote_screen", {persons: people, id: req.params.id, gift: rounds[round].description});
            people[req.cookies["id"]].notcurrent = true;
        }
    }
};

exports.vote_post = function (req, res) {
    if(!("id" in req.cookies)) {        // Person has not logged in yet
        res.redirect("/login");
    }
    else {      // Person has logged in
        if (!(req.cookies["id"] in people)) {   // Person has logged in but server forgot
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
            votes[req.cookies["id"]] = 0;
        }
        if (people[req.cookies["id"]].round >= round) {     // Person is not allowed to vote (yet)
            people[req.cookies["id"]].round = round;
            res.redirect("/waiting_room");
        }
        else {      // Person is allowed to vote
            if (req.body.person.toString() === "mine") {        // Person has claimed the gift
                if(rounds[round].owner !== undefined && rounds[round].owner !== req.cookies["id"]) {    // gift already claimed
                    error = "Meerdere mensen hebben het cadeau opgeëist, de ronde begint opnieuw.";
                    // Errors can only be handled at the end of the round
                    rounds[round].owner = undefined;
                }
                else {  // gift claimed successfully
                    rounds[round].setOwner(req.cookies["id"]);
                    votes[req.cookies["id"]] += 1;
                    if(people[req.cookies["id"]].rounds.length === round+1) {
                        // last round was invalid and has restarted; existing gift may be invalid
                        people[req.cookies["id"]].rounds[round] = req.body.person;
                    }
                    else {  // no problems
                        people[req.cookies["id"]].rounds.push(req.body.person);
                    }
                }
            }
            else if (req.body.person in votes) {    // successful vote
                votes[req.body.person] += 1;
                if(people[req.cookies["id"]].rounds.length === round+1) {
                    // last round was invalid and has restarted; existing gift may be invalid
                    people[req.cookies["id"]].rounds[round] = req.body.person;
                }
                else {  // no problems
                    people[req.cookies["id"]].rounds.push(req.body.person);
                }
            }
            else {  // person not found, should not happen
                console.log(votes);
                console.log(req.body.person.toString());
                console.log(typeof req.body.person.toString());
                throw new Error();
            }
            voted += 1;
            people[req.cookies["id"]].round = round;
            hostSocket.send("" + (Math.floor(voted * 100 / Object.keys(people).length)) + "%");
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
    people[req.body.person].playing = false;
    gifts.pop();
    res.redirect("/gift")
};

exports.invalid = function (req, res) {
    res.render("host_views/Invalid_round", {error: error})
};

exports.host_result = function(req, res) {
    /*
    // Uncomment for testing
    for (let i=0; i < 10; i++) {
        people["person"+i] = new Player("person"+i);
        people["person"+i].right = Math.floor(Math.random() * 50)
    } */

    for(let key in people) {
        if (people.hasOwnProperty(key)) {
            let count = 0;
            for (let i = 0; i < rounds.length; i++) {
                for (let person_key in people) {
                    if (person_key !== undefined && people.hasOwnProperty(person_key)) {
                        let person = people[person_key];
                        if (person.rounds[i] === rounds[i].owner) {
                            count++;
                        }
                    }
                }
            }
            people[key].right = count;
        }
    }

    finished = true;
    
    connects.forEach(socket => {
        socket.send("finished")
    });

    res.render("host_views/result_host", {people: Object.values(people).sort(function(a, b){return b.right - a.right})});
};

exports.client_result = function(req, res) {
    res.render("client_views/result_client", {rounds: rounds, person: people[req.cookies["id"]]});
};
