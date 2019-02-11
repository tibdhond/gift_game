let people = {};

let votes = {};
let voted = 0;
let gifts = [];
let gift = undefined;
let complete = false;
let round = 0;
let error = "";

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
        this.round = 0;
        this.playing = true;
        this.notcurrent = true;
    }
}

exports.home = function(req, res) {
    res.redirect("/login");
};

exports.login = function (req, res) {
    if('id' in req.cookies) {
        if (!(req.cookies["id"] in people)) {
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
        }
        res.redirect("/waiting_room");
    }
    else {
        res.render("login.pug", {taken: false, nick: ""});
    }
};

exports.newPerson = function (req, res) {
    if (!(req.body.Name.toString() in people)) {
        people[req.body.Name.toString()] = new Player(req.body.Name.toString());
        votes[req.body.Name.toString()] = 0;
        res.cookie("id", req.body.Name.toString(), {maxAge : 2 * 24 * 3600000}).redirect("/waiting_room"); // 2 days
    }
    else {
        res.render("login.pug", {taken: true, nick: req.body.Name.toString()})
    }
};

exports.person_list = function (req, res) {
   res.render("persons.pug", {persons: people});
};

exports.person_delete = function(req, res) {
    delete people[req.body.person];
    delete votes[req.body.person];
    res.redirect("/" + req.params.origin);
};

exports.next_gift = function (req, res) {

    if(gift !== undefined) {
        gifts.push(gift);
        gift = undefined;
    }

    let next = undefined;
    if (complete) {
        let z = (2 / (gifts.length - 1)) / gifts.length;
        let index = gifts.length - 1 - (Math.floor(1/2 + Math.sqrt(8 * Math.random() + z) / (2*Math.sqrt(z))));
        gift = gifts[index];
        next = gift;
        gifts.splice(index, 1);
    }
    console.log(gifts);
    res.render("next.pug", {gift: next !== undefined ? next.description.toString() : "", complete: complete});

};

exports.new_gift = function (req, res) {
    complete = req.body.rTrue !== undefined;
    gift = new Gift(req.body.gift);

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
    if(voted === Object.keys(people).length) {
        if (gift.owner === undefined && error === "") {
            error = "Niemand heeft het cadeau opgeëist, de ronde begint opnieuw."
        }

        if (error !== "") {
            res.redirect("/invalid");
        }
        else {
            gifts.push(gift);
            gift = undefined;
            res.redirect("/scoreboard");
        }
    }
    else {
        res.render("host_wait.pug", {
            voted: voted,
            length: Object.keys(people).length,
            ratio: "" + (Math.floor(voted * 100 / Object.keys(people).length)) + "%",
            gift: gift.description
        });
    }
};

exports.scoreboard = function (req, res) {
    res.render("scoreboard.pug", {votes: votes, length: Object.keys(people).length});
};

exports.wait = function (req, res) {
    if(!("id" in req.cookies)) {
        res.redirect("/login");
    }
    else {
        if (!(req.cookies["id"] in people)) {
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
            votes[req.cookies["id"]] = 0;
        }
        if(people[req.cookies["id"]].round !== round) {
            res.redirect("/vote");
        }
        else {
            res.render("client_wait.pug");
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
            res.render("vote_screen", {persons: people, id: req.params.id, gift: gift.description});
            people[req.cookies["id"]].notcurrent = true;
        }
    }
};

exports.vote_post = function (req, res) {
    if(!("id" in req.cookies)) {
        res.redirect("/login");
    }
    else {
        if (!(req.cookies["id"] in people)) {
            people[req.cookies["id"]] = new Player(req.cookies["id"]);
            votes[req.cookies["id"]] = 0;
        }
        if (people[req.cookies["id"]].round >= round) {
            people[req.cookies["id"]].round = round;
            res.redirect("/waiting_room");
        }
        else {
            if (req.body.person.toString() === "mine") {
                if(gift.owner !== undefined && gift.owner !== req.cookies["id"]) {
                    error = "Meerdere mensen hebben het cadeau opgeëist, de ronde begint opnieuw.";
                    gift.owner = undefined;
                }
                else {
                    gift.setOwner(req.cookies["id"]);
                    votes[req.cookies["id"]] += 1;
                }
            }
            else if (req.body.person in votes) {
                votes[req.body.person] += 1;
            }
            else {
                console.log(votes);
                console.log(req.body.person.toString());
                console.log(typeof req.body.person.toString());
                throw new Error();
            }
            voted += 1;
            people[req.cookies["id"]].round = round;
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
    console.log(votes);
    res.redirect("/gift")
};

exports.invalid = function (req, res) {
    res.render("Invalid_round", {error: error})
};