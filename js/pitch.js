
document.getElementById('back-to-instructions').addEventListener('click', () => {
  window.location.href = 'game.html';  // Navigate back to the instructions page
});

document.querySelectorAll('nav a').forEach(link => {
  link.addEventListener('click', function(event) {
    event.preventDefault();
    const targetId = this.getAttribute('href').substring(1);
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
       window.location.hash = this.getAttribute('href');
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".section");

  const revealSection = () => {
    sections.forEach(section => {
      const sectionTop = section.getBoundingClientRect().top;

      // Make lower sections visible immediately if too far down
      if (sectionTop < window.innerHeight + 600 || section.id === "faq-development" || section.id === "original-pitch") { 
        section.classList.add("visible");
      }
    });
  };

  window.addEventListener("scroll", revealSection);
  revealSection(); // Run once on load
});



