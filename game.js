(function(window, $) {
    // 10 seconds
    var TIMER_DEFAULT = 10000;
    var DEAD_TIMER_DEFAULT = 4000;
    var DEAD_TIMER_LOST = 10000;
    var COUNTDOWN_TIMER = 3000;

    var ONE_REM = 16;
    var TWO_REM = 2 * ONE_REM;
    var THREE_REM = 3 * ONE_REM;
    var FOUR_REM = 4 * ONE_REM;

    var CLASS_GAME_LOST = 'game-lost';
    var CLASS_GAME_WON = 'game-won';
    var CLASS_GAME_COUNTDOWN = 'countdown';
    var CLASS_POINTS_TO_AWARD = 'has-points'

    // these persist for the duration of a game
    var gameSettings = {
        operations: '+',
        terms: 5,
        min: 0,
        max: 100,
        decimals: 2,
        frameRate: 30,
        frameDelay: 1000 / 30,
        threshold: 0.8
    }

    // these reflect the immediate state of the game and will change throughout the game
    var gameState = {
        numbers: [],
        equation : undefined,
        solution: 0,
        guess: undefined,
        score: 0,
        pointsToAward: {},
        timer: TIMER_DEFAULT,
        isWonRound : false,
        isLostRound : false,
        deadTimer : 0,
        countdownTimer : 0,
        isPaused : false
    };

    var deviceState = {
        isScrolling : false,
        windowHeight : 0
    }

    var viewObjects = {}

    $(document).ready(function() {
        loadGameObjects();

        viewObjects.settings.show();
        gameState.isPaused = true;

        setInterval(step, gameSettings.frameDelay)
    });

    function step() {
        if (gameState.isPaused) {
            updateView();
            return;
        }

        if (!gameState.numbers.length) {
            startNewRound();
        } else if (gameState.deadTimer > 0 || gameState.pointsToAward.total > 0) {
            if (gameState.deadTimer > 0) {
                // this doesn't account for game processing time.
                gameState.deadTimer -= gameSettings.frameDelay;

                if (gameState.deadTimer <= 0) {
                    gameState.deadTimer = 0;
                    startNewRound();
                }
            }

            if (gameState.deadTimer <= (DEAD_TIMER_DEFAULT - 1) && gameState.pointsToAward.total > 0) {
                var amountToMove = Math.min(10, gameState.pointsToAward.total);
                gameState.score += amountToMove;
                gameState.pointsToAward.total -= amountToMove;
            }
        } else if (gameState.countdownTimer > 0) {
            // this doesn't account for game processing time.
            gameState.countdownTimer -= gameSettings.frameDelay;

            // if we run out of time
            if (gameState.countdownTimer <= 0) {
                gameState.countdownTimer = 0;
            }
        } else {
            // this doesn't account for game processing time.
            gameState.timer -= gameSettings.frameDelay;

            // if we run out of time
            if (gameState.timer <= 0) {
                gameState.timer = 0;
                handleLost();
            }
        }

        updateView();
    }

    // -------------------------------------------------------------------------
    // RENDERING
    // -------------------------------------------------------------------------

    function updateView() {
        // redraw timer
        updateDecimalContainer(viewObjects.timer, gameState.timer / 1000, (gameState.timer === TIMER_DEFAULT ? 0 : 2));

        if (!gameState.pointsToAward.awarded) {
            if (gameState.pointsToAward.speed > 0.75) {
                viewObjects.speedBonus.addClass('revealed');
                gameState.pointsToAward.speed = 0;

                setTimeout(() => {
                    viewObjects.speedBonus.removeClass('revealed');
                }, DEAD_TIMER_DEFAULT)
            }
            if (gameState.pointsToAward.accuracy > 0.95) {
                viewObjects.accuracyBonus.addClass('revealed');
                gameState.pointsToAward.accuracy = 0;

                setTimeout(() => {
                    viewObjects.accuracyBonus.removeClass('revealed');
                }, DEAD_TIMER_DEFAULT)
            }

            // update score and pointsToAward
            viewObjects.pointsToAward.text(gameState.pointsToAward.total);

            if (gameState.pointsToAward.total === 0) {
                gameState.pointsToAward.awarded = true;
            }
        }
        viewObjects.score.text(gameState.score);

        if (gameState.deadTimer  > 0) {
            updateDecimalContainer(viewObjects.solution, gameState.solution)

            if (gameState.isWonRound) {

            } else {

            }
        } else {
            updateDecimalContainer(viewObjects.solution, null)
        }

        if (gameState.countdownTimer > 0) {
            viewObjects.countdownTimer.show();
            viewObjects.countdownTimer.find('.modal').text(parseInt(gameState.countdownTimer/1000) + 1);
        } else {
            viewObjects.countdownTimer.hide();
        }
    }

    function loadGameObjects() {
        viewObjects.gameContainer = $("#game-container");
        viewObjects.scrollContainer = $('#scroll-container');
        viewObjects.scrollBar = $('#scroll-bar');
        deviceState.barHeight = viewObjects.scrollBar.height();
        viewObjects.scrollContainer.on('mousedown touchstart', handleScrollStart)
        viewObjects.scrollContainer.on('mousemove touchmove', handleScroll)
        viewObjects.scrollContainer.on('mouseup touchend', submitGuess)

        viewObjects.rangeMax = $('#range-max');
        viewObjects.rangeMin = $('#range-min');
        viewObjects.guess = $('#guess');
        viewObjects.timer = $('#timer');
        viewObjects.score = $('#score');
        viewObjects.solution = $('#solution');
        viewObjects.numbersContainer = $('#numbers-container');

        viewObjects.numberTemplate = $('#number-template').html();

        viewObjects.pointsToAward = $('#points-to-award');
        viewObjects.speedBonus = $('#speed-bonus');
        viewObjects.accuracyBonus = $('#accuracy-bonus');
        viewObjects.countdownTimer = $('#countdown-timer');
        viewObjects.settings = $('#settings');
        viewObjects.settingsToggle = $('#settings-toggle');
        viewObjects.settingsToggle.click(toggleSettings)

        viewObjects.startNewGame = $('#start-new-game');
        viewObjects.startNewGame.click(startNewGame);

        // preload our defaults
        viewObjects.settings.find('input').each(function(index, elem) {
            var $elem = $(elem);
            $elem.val(gameSettings[$elem.attr('name')]);
        })

        viewObjects.window = $(window);
        deviceState.windowHeight = viewObjects.window.height();
    }

    function updateDecimalContainer($container, value, decimals) {
        if (value === undefined || value === null) {
            return $container.find('span').html('&nbsp;')
        }

        decimals = isNaN(parseInt(decimals)) ? gameSettings.decimals : decimals ;
        var intVal = parseInt(value);
        $container.find('.int').text(intVal);

        if (decimals > 0) {
            var decimalString;
            if (intVal === value) {
                decimalString = '';
            } else {
                var start = 2;
                // account for the negative sign
                if (value < 0) {
                    start++;
                }
                var stop = start + decimals;
                var decimalString = ('' + (value - intVal)).slice(start, stop);
            }

            if (decimalString.length < decimals) {
                decimalString += Array(decimals - decimalString.length + 1).join('0')
            }
            $container.find('.decimal').text('.' + decimalString)
        } else {
            $container.find('.decimal').html('&nbsp;');
        }
    }

    function resetScrollBar() {
        // drag the bar back to bottom
        updateGuessObject(deviceState.windowHeight)
        viewObjects.scrollBar.css('top', deviceState.windowHeight - (deviceState.barHeight / 2));
    }

    function toggleSettings() {
        viewObjects.settings.toggle();

        gameState.isPaused = viewObjects.settings.is(':visible');
    }

    // -------------------------------------------------------------------------
    // GAME FLOW
    // -------------------------------------------------------------------------
    function startNewGame() {
        // hide settings and load them
        viewObjects.settings.hide();

        // load our settings
        viewObjects.settings.find('input').each(function(index, elem) {
            var $elem = $(elem);
            gameSettings[$elem.attr('name')] = parseInt($elem.val());
        })

        gameState.score = 0;
        gameState.pointsToAward = {};

        gameState.isPaused = false;
        gameState.countdownTimer = COUNTDOWN_TIMER;
        gameState.score = 0;
        viewObjects.gameContainer.removeClass();
        startNewRound();
        viewObjects.gameContainer.addClass(CLASS_GAME_COUNTDOWN);
        setTimeout(() => {
            viewObjects.gameContainer.removeClass(CLASS_GAME_COUNTDOWN);
        }, COUNTDOWN_TIMER)


    }

    function startNewRound() {
        gameState.numbers = pickNewNumbers();
        gameState.equation = buildEquation(gameState.numbers)
        gameState.solution = solveEquation(gameState.equation)
        gameState.isWonRound = false;
        gameState.isLostRound = false;
        gameState.timer = TIMER_DEFAULT;
        gameState.deadTimer = 0;

        viewObjects.gameContainer.removeClass();

        viewObjects.numbersContainer.children().remove();
        var newNumbers = [];
        gameState.numbers.forEach((n) => {
            var $num = $(viewObjects.numberTemplate);
            updateDecimalContainer($num, n, gameSettings.decimals);
            newNumbers.push($num);
        })
        viewObjects.numbersContainer.append(newNumbers);

        // set the range indicators
        viewObjects.rangeMax.text(getRangeMax());
        viewObjects.rangeMin.text(getRangeMin());

        // resetScrollBar
        resetScrollBar()
    }

    function handleLost() {
        gameState.deadTimer = DEAD_TIMER_LOST;
        deviceState.isScrolling = false;
        gameState.isLostRound = true;
        gameState.isPaused = true;
        viewObjects.gameContainer.addClass(CLASS_GAME_LOST);
    }

    function handleScrollStart(ev) {
        if (gameState.deadTimer === 0) {
            deviceState.isScrolling = true;
        }
    }

    function handleScroll(ev) {
        if (deviceState.isScrolling) {
            var pos = ev.clientY === undefined ? ev.touches[0].clientY : ev.clientY;
            updateGuessObject(pos)
        }
    }

    function submitGuess() {
        if (!deviceState.isScrolling) {
            return;
        }
        deviceState.isScrolling = false;
        var accuracy = 1 - Math.abs((gameState.solution - gameState.guess) / gameState.solution);
        console.log(gameState.solution, gameState.guess, accuracy);
        // if the guess is off by too much,
        if ( accuracy < gameSettings.threshold) {
            return handleLost();
        }

        viewObjects.gameContainer.addClass(CLASS_GAME_WON);

        // enter dead time
        gameState.deadTimer = DEAD_TIMER_DEFAULT;

        // award base points for difficulty
        gameState.pointsToAward = {
            base : gameSettings.terms,
            complexity : getNumbersRange(gameState.numbers),
            accuracy : accuracy,
            speed : gameState.timer / TIMER_DEFAULT,
            awarded : false
        };

        gameState.pointsToAward.total = (gameState.pointsToAward.base * gameState.pointsToAward.complexity)
            * gameState.pointsToAward.accuracy
            * (gameState.pointsToAward.speed > 0.5 ? 1.5 : 1)

        gameState.pointsToAward.total = parseInt(gameState.pointsToAward.total);

        viewObjects.pointsToAward.addClass(CLASS_POINTS_TO_AWARD);
    }

    function updateGuessObject(top) {
        viewObjects.scrollBar.css('top', top - (deviceState.barHeight / 2)) ;

        viewObjects.guess.css('top', Math.max(Math.min(top, deviceState.windowHeight - FOUR_REM), THREE_REM) - ONE_REM) ;

        var min = getRangeMin();
        var max = getRangeMax();
        var range = max - min;
        gameState.guess = min + (range * (1 - (top / deviceState.windowHeight)));
        updateDecimalContainer(viewObjects.guess, gameState.guess);
    }

    // -------------------------------------------------------------------------
    // GAME MECHANICS
    // -------------------------------------------------------------------------

    function solveEquation(equation) {
        return eval(equation.join(''));
    }

    function buildEquation(numbers) {
        var equation = [];
        shuffle(numbers);
        numbers.forEach((n) => {
            equation.push(n);
            equation.push(getRandomOperation())
        })

        // we will have one trailing operation, so we just remove it.
        equation.pop();

        return equation;
    }

    function pickNewNumbers() {
        var retVal = [];
        for (var i=0; i<gameSettings.terms; i++) {
            var newNumber = gameSettings.min + (Math.random() * (gameSettings.max - gameSettings.min));
            if (gameSettings.decimals === 0) {
                newNumber = Math.round(newNumber);
            } else {
                var power = Math.pow(10, gameSettings.decimals)
                newNumber = parseInt(newNumber * power) / power;
            }
            retVal.push(newNumber)
        }
        return retVal;
    }

    function getRandomOperation() {
        if (gameSettings.operations.length === 1) {
            return gameSettings.operations;
        }

        return gameSettings.operations[Math.floor(Math.random() * gameSettings.operations.length)];
    }

    function shuffle(array) {
        for (var i=0; i<array.length; i++) {
            var swapIndex = Math.floor(Math.random() * array.length);
            if (swapIndex === i) {
                continue;
            }
            var temp = array[swapIndex];
            array[swapIndex] = array[i];
            array[i] = temp;
        }
    }

    function getNumbersRange(array) {
        var min = 0;
        var max = 0;
        array.forEach((n) => {
            min = Math.min(min, n)
            max = Math.max(max, n)
        })
        return max - min;
    }

    function getRangeMax() {
        return gameSettings.max * gameSettings.terms
    }

    function getRangeMin() {
        return gameSettings.min * gameSettings.terms
    }
})(window, jQuery);