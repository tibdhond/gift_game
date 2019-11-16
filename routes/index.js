let express = require('express');
let router = express.Router();
let controller = require('../controllers/controller.js');
let connects = [];

/* GET home page. */
router.ws('/client', controller.newSocket);
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
router.get('/host_result', controller.host_result);
router.get('/client_result', controller.client_result);
module.exports = router;

