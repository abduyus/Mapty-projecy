'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration * 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 91, 178);

// console.log(run1, cycling1);

//////////////////////////////////////////////////
// Application arcitecture
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const editBtn = document.querySelector('.edit-btn');
const deleteBtn = document.querySelector('.delete-btn');
const deleteAllBtn = document.querySelector('.delete-all-btn');
const posBtn = document.querySelector('.pos-btn');

class App {
  #map;
  #mapZoomLevel = 16;
  #mapEvent;
  #workouts = [];
  #drawnItems;

  constructor() {
    // Get users position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    containerWorkouts.addEventListener(
      'click',
      function (e) {
        if (e.target.classList.contains('edit-btn')) {
          // Handle edit button click
          this._editWorkout(e.target.closest('.workout'));
        }
      }.bind(this)
    );
    containerWorkouts.addEventListener(
      'click',
      function (e) {
        if (e.target.classList.contains('delete-btn')) {
          // Handle edit button click
          this._deleteWorkout(e.target.closest('.workout'));
        }
      }.bind(this)
    );
    deleteAllBtn.addEventListener('click', this.reset.bind(this));
    posBtn.addEventListener('click', this._posMap.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          this._showAlert('Could not get your position');
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    console.log(this);
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();

    // Check if mapEvent is defined
    if (!this.#mapEvent) {
      this._showAlert('Please click on the map first!');
      return;
    }

    const validInputs = (...inputs) =>
      inputs.every(imp => Number.isFinite(imp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    console.log(this.#mapEvent);
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._showAlert('Input has to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._showAlert('Input has to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);
    // console.log(workout);
    // console.log(this);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + Clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _editWorkout(e) {
    const workout = this.#workouts.find(work => work.id === e.dataset.id);
    console.log(workout);

    form.classList.remove('hidden');
    inputDistance.focus();

    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    if (workout.type === 'running') {
      inputCadence.value = workout.cadence;
    } else {
      inputElevation.value = workout.elevationGain;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      console.log(inputDistance.value, inputDuration.value, inputType.value);

      workout.distance = +inputDistance.value;
      workout.duration = +inputDuration.value;
      if (workout.type === 'running') {
        workout.cadence = +inputCadence.value;
      } else {
        workout.elevationGain = +inputElevation.value;
      }

      // Clear the input fields
      inputDistance.value =
        inputDuration.value =
        inputCadence.value =
        inputElevation.value =
          '';

      // Hide the form
      form.classList.add('hidden');
    });
  }

  _deleteWorkout(e) {
    const workout = this.#workouts.find(work => work.id === e.dataset.id);
    const index = this.#workouts.indexOf(workout);
    this.#workouts.splice(index, 1);
    location.reload();
    localStorage.setItem('workout', JSON.stringify(this.#workouts));
  }

  _posMap() {
    // Create an empty LatLngBounds object
    let bounds = new L.LatLngBounds();

    // Loop over your workouts array
    this.#workouts.forEach(workout => {
      // Extend the bounds to include each marker's location
      bounds.extend(workout.coords);
    });

    // Adjust the viewport to show all markers
    this.#map.fitBounds(bounds);
  }

  _renderWorkoutMarker(workout) {
    console.log(workout.coords);
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 260,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      
          `;

    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
          <div>
          <div class="workout-edit">
            <button class="edit-btn">✏️</button>
          </div>
          <div class="workout-delete">
            <button class="delete-btn">❌</button>
          </div>
          </div>
        </li>
        `;
    }

    if (workout.type === 'cycling') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
          <div>
          <div class="workout-edit">
            <button class="edit-btn">✏️</button>
          </div>
          <div class="workout-delete">
            <button class="delete-btn">❌</button>
          </div>
          </div>
          </li>
        `;
    }
    html += `
          `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workout', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workout'));
    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _showAlert(msg) {
    const modal = document.querySelector('.modal');
    const overlay = document.querySelector('.overlay');
    const btnCloseModal = document.querySelector('.close-modal');
    const modalText = document.querySelector('.modal-text');

    modalText.textContent = msg;

    const openModal = function () {
      modal.classList.remove('hidden');
      overlay.classList.remove('hidden');
    };

    const closeModal = function () {
      modal.classList.add('hidden');
      overlay.classList.add('hidden');
    };

    openModal();

    btnCloseModal.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', function (e) {
      // console.log(e.key);

      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  reset() {
    localStorage.removeItem('workout');
    location.reload();
  }
}

const app = new App();
