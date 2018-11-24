var assert = require('assert');
var sinon = require('sinon');
var constants = require('../lib/constants');

var child_process = require('child_process');
var settingsController = require('../lib/settingsController');

var mopidy = require('../lib/mopidy.js');

describe('Mopidy', function () {

    var sandbox;
    beforeEach(function () {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function () {
        sandbox.restore();
        mopidy.mopidyProcess = undefined;
    });

    describe('start', function () {
        it('should start a mopidy process', function (done) {

            var oProcess = {
                stderr: {
                    on: function () {
                    }
                }
            };
            sandbox.stub(oProcess.stderr, 'on').yields('HTTP server running');
            var oChildProcessStub = sandbox.stub(child_process, 'spawn').withArgs('mopidy').returns(oProcess);

            mopidy.start().then(function () {
                assert(oChildProcessStub.calledOnce);
                done();
            });

        });
        it('should fail when trying to start two processes', function (done) {


            var oProcess = {
                stderr: {
                    on: function () {
                    }
                }
            };
            sandbox.stub(oProcess.stderr, 'on').yields('HTTP server running');
            var oChildProcessStub = sandbox.stub(child_process, 'spawn').withArgs('mopidy').returns(oProcess);

            mopidy.start().then(function () {
                mopidy.start()
                    .catch(function (oError) {
                        assert(oChildProcessStub.calledOnce);
                        assert(oError.status === 500);
                        done();
                    });
            });
        });
    });

    describe('stop', function () {
        it('should stop an existing mopidy process', function (done) {
            var oProcess = {
                kill: function () {
                },
                on: function () {

                }
            };
            mopidy.mopidyProcess = oProcess;
            var oProcessStub = sandbox.stub(oProcess, 'kill').withArgs('SIGTERM');
            sandbox.stub(oProcess, 'on').withArgs('close').yields();

            mopidy.stop().then(function () {
                assert(oProcessStub.calledOnce);
                done();
            });
        });
        it('should do nothing because there is no existing process', function (done) {
            mopidy.mopidyProcess = undefined;

            mopidy.stop().then(function () {
                done();
            });
        });
    });

    describe('restart', function () {
        it('should stop and restart the mopidy process', function (done) {
            var oStopStub = sandbox.stub(mopidy, 'stop').resolves();
            var oStartStub = sandbox.stub(mopidy, 'start').resolves();

            mopidy.restart().then(function () {
                assert(oStopStub.calledOnce);
                assert(oStartStub.calledOnce);
                done();
            });
        });
    });

    describe('_playItem', function () {
        it('should not do anything if no figure data is given', function (done) {
            mopidy.mopidy =  {
                tracklist: {
                    clear: function() {
                        assert(false);
                        return Promise.resolve();
                    },
                    add: function(oItem) {
                        assert(false);
                        return Promise.resolve();
                    }
                },
                library: {
                    lookup: function(sUri) {
                        assert(false);
                        return Promise.resolve({item: true});
                    }
                },
                playback: {
                    setVolume: function(iVolume) {
                        assert(false);
                        return Promise.resolve();
                    },
                    play: function() {
                        assert(false);
                        return Promise.resolve();
                    },
                    seek: function(iPosition) {
                        assert(false);
                        return Promise.resolve();
                    }
                }
            };

            mopidy._playItem(null).then(function() {
                done();
            });
        });
        it('should seek if position > 0', function (done) {
            var iSeekPosition = null,
                bSeekCalled = false;
            mopidy.mopidy =  {
                tracklist: {
                    clear: function() {
                        return Promise.resolve();
                    },
                    add: function(oItem) {
                        return Promise.resolve();
                    }
                },
                library: {
                    lookup: function(sUri) {
                        return Promise.resolve({item: true});
                    }
                },
                playback: {
                    setVolume: function(iVolume) {
                        return Promise.resolve();
                    },
                    play: function() {
                        return Promise.resolve();
                    },
                    seek: function(iPosition) {
                        bSeekCalled = true;
                        iSeekPosition = iPosition;
                        return Promise.resolve();
                    }
                }
            };

            mopidy._playItem({progress: 10}).then(function() {
                assert(bSeekCalled);
                assert(iSeekPosition == 10);
                done();
            });
        });
        it('should not seek if not position > 0', function (done) {
            var iSeekPosition = null,
                bSeekCalled = false;
            mopidy.mopidy =  {
                tracklist: {
                    clear: function() {
                        return Promise.resolve();
                    },
                    add: function(oItem) {
                        return Promise.resolve();
                    }
                },
                library: {
                    lookup: function(sUri) {
                        return Promise.resolve({item: true});
                    }
                },
                playback: {
                    setVolume: function(iVolume) {
                        return Promise.resolve();
                    },
                    play: function() {
                        return Promise.resolve();
                    },
                    seek: function(iPosition) {
                        bSeekCalled = true;
                        iSeekPosition = iPosition;
                        return Promise.resolve();
                    }
                }
            };

            mopidy._playItem({progress: 0}).then(function() {
                assert(!bSeekCalled);
                done();
            });

            mopidy._playItem({progress: null}).then(function() {
                assert(!bSeekCalled);
                done();
            });
        });
    });

    describe('onVolumeChange', function () {
        it('should increase the volume', function (done) {
            var oGetCurrentVolumeStub = sandbox.stub(settingsController, 'getCurrentVolume').resolves(70);
            var oMaxVolumeStub = sandbox.stub(settingsController, 'getMaxVolume').resolves(100);
            var iNewCurrentVolume;
            var oSetCurrentVolumeStub = sandbox.stub(settingsController, 'setCurrentVolume').callsFake(function(iCurrentVolumeToSet) {
                iNewCurrentVolume = iCurrentVolumeToSet;
            });
            var iCurrentVolumeToSet;
            mopidy.mopidy =  {
                playback: {
                    setVolume: function(iVolume) {
                        iCurrentVolumeToSet = iVolume;
                        return Promise.resolve();
                    }
                }
            };

            mopidy.onVolumeChange(constants.VolumeChange.Increase).then(function () {
                assert(iNewCurrentVolume === 70 + constants.VolumeChange.Interval);
                assert(iCurrentVolumeToSet === 70 + constants.VolumeChange.Interval);

                assert(oGetCurrentVolumeStub.calledOnce);
                assert(oMaxVolumeStub.calledOnce);
                assert(oSetCurrentVolumeStub.calledOnce);
                done();
            });
        });
        it('should decrease the volume', function (done) {
            var oGetCurrentVolumeStub = sandbox.stub(settingsController, 'getCurrentVolume').resolves(70);
            var oMaxVolumeStub = sandbox.stub(settingsController, 'getMaxVolume').resolves(100);
            var iNewCurrentVolume;
            var oSetCurrentVolumeStub = sandbox.stub(settingsController, 'setCurrentVolume').callsFake(function(iCurrentVolumeToSet) {
                iNewCurrentVolume = iCurrentVolumeToSet;
            });
            var iCurrentVolumeToSet;
            mopidy.mopidy =  {
                playback: {
                    setVolume: function(iVolume) {
                        iCurrentVolumeToSet = iVolume;
                        return Promise.resolve();
                    }
                }
            };

            mopidy.onVolumeChange(constants.VolumeChange.Decrease).then(function () {
                assert(iNewCurrentVolume === 70 - constants.VolumeChange.Interval);
                assert(iCurrentVolumeToSet === 70 - constants.VolumeChange.Interval);

                assert(oGetCurrentVolumeStub.calledOnce);
                assert(oMaxVolumeStub.calledOnce);
                assert(oSetCurrentVolumeStub.calledOnce);
                done();
            });
        });
        it('should not increase the volume', function (done) {
            var oGetCurrentVolumeStub = sandbox.stub(settingsController, 'getCurrentVolume').resolves(70);
            var oMaxVolumeStub = sandbox.stub(settingsController, 'getMaxVolume').resolves(70);
            var oSetCurrentVolumeStub = sandbox.stub(settingsController, 'setCurrentVolume');
            mopidy.mopidy =  {
                playback: {
                    setVolume: function() {
                        assert(false);
                    }
                }
            };

            mopidy.onVolumeChange(constants.VolumeChange.Increase).then(function () {
                assert(oGetCurrentVolumeStub.calledOnce);
                assert(oMaxVolumeStub.calledOnce);
                assert(oSetCurrentVolumeStub.notCalled);
                done();
            });
        });
        it('should not decrease the volume', function (done) {
            var oGetCurrentVolumeStub = sandbox.stub(settingsController, 'getCurrentVolume').resolves(5);
            var oMaxVolumeStub = sandbox.stub(settingsController, 'getMaxVolume').resolves(100);
            var oSetCurrentVolumeStub = sandbox.stub(settingsController, 'setCurrentVolume');
            mopidy.mopidy =  {
                playback: {
                    setVolume: function() {
                        assert(false);
                    }
                }
            };

            mopidy.onVolumeChange(constants.VolumeChange.Decrease).then(function () {
                assert(oGetCurrentVolumeStub.calledOnce);
                assert(oMaxVolumeStub.calledOnce);
                assert(oSetCurrentVolumeStub.notCalled);
                done();
            });
        });
        it('should do nothing if no track is playing', function (done) {
            var oGetCurrentVolumeStub = sandbox.stub(settingsController, 'getCurrentVolume');
            var oMaxVolumeStub = sandbox.stub(settingsController, 'getMaxVolume');
            var oSetCurrentVolumeStub = sandbox.stub(settingsController, 'setCurrentVolume');
            mopidy.mopidy = undefined;

            mopidy.onVolumeChange(constants.VolumeChange.Increase).then(function () {
                assert(oGetCurrentVolumeStub.notCalled);
                assert(oMaxVolumeStub.notCalled);
                assert(oSetCurrentVolumeStub.notCalled);
                done();
            });
        });
    });

});