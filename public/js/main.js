// Fetch and display cars dynamically
fetch('/api/cars')
  .then(response => response.json())
  .then(cars => {
    const carsGrid = document.getElementById('carsGrid');
    cars.forEach(car => {
      const carItem = document.createElement('div');
      carItem.className = 'car-item';
      carItem.innerHTML = `
        <img src="${car.image_url}" alt="${car.make} ${car.model}">
        <h3>${car.make} ${car.model}</h3>
        <p>${car.description}</p>
      `;
      carsGrid.appendChild(carItem);
    });
  });
// Existing code for fetching cars...

// Burger menu functionality
document.addEventListener('DOMContentLoaded', function() {
  const burger = document.querySelector('.burger-menu');
  const nav = document.querySelector('.nav-links');

  if (burger && nav) {
    burger.addEventListener('click', function() {
      nav.classList.toggle('active');
    });
  }
});