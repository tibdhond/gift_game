let express = require('express');
let ws = require('express-ws');
let router = express.Router();
controller = require('../controller.js');

/* GET home page. */
router.get('/', controller.home);
router.get('/login', controller.login);
router.post('/login', controller.newPerson);
router.get('/people', controller.person_list);
router.post('/people/delete/:origin', controller.person_delete);
router.post('/people/juist', controller.has_gift);
router.get("/gift", controller.next_gift);
router.post("/gift", controller.new_gift);
router.get('/host_wait', controller.host_wait);
router.get('/scoreboard', controller.scoreboard);
router.get('/waiting_room', controller.wait);
router.get('/vote', controller.nocache, controller.vote_get);
router.post('/vote', controller.vote_post);
router.post('/reset', controller.reset);
router.get('/invalid', controller.invalid);
module.exports = router;
