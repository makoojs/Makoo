const getReleaseLine = async (changeset) => {
	return changeset.summary.trimEnd();
};

const getDependencyReleaseLine = async () => {
	return '';
};

module.exports = {
	getReleaseLine,
	getDependencyReleaseLine
};
