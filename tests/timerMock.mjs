const Timer = {
	set(callback) {
		return setTimeout(callback, 0);
	},
	clear(timer) {
		clearTimeout(timer);
	},
};

export default Timer;
