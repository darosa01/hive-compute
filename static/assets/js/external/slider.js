
class Slider{

	#currentSlideIndex;
	#slideArray;
	#slideIndex;

	constructor(){
		this.#slideIndex = 0;
		this.#currentSlideIndex = 0;
		this.#slideArray = [];
	}

	clearSlider(){
		this.#slideArray = [];
	}

	createSlide(title, subtitle, background, link) {
		var newSlide = {
			title: title,
			subtitle: subtitle,
			link: link,
			background: background,
			id: "slide" + this.#slideIndex
		}

		this.#slideArray.push(newSlide);
	}

	buildSlider(){
		var myHTML;

		for(var i = 0; i < this.#slideArray.length; i++) {
			myHTML += "<div id='" + this.#slideArray[i].id + 
			"' class='singleSlide' style='background-image:url(" + this.#slideArray[i].background + ");'>" + 
			"<div class='slideOverlay'>" + 
			"<h1>" + this.#slideArray[i].title + "</h1>" +
			"<h4>" + this.#slideArray[i].subtitle + "</h4>" +
			"<a href='" + this.#slideArray[i].link + "' target='_blank'>Find out more</a>" +
			"</div>" +
			"</div>";	
		}

		document.getElementById("mySlider").innerHTML = myHTML;
		document.getElementById("slide" + this.#currentSlideIndex).style.left = 0;
	}

	prevSlide(){
		var nextSlideIndex;

		if(this.#slideArray.length < 2){
			return;
		}

		if (this.#currentSlideIndex === 0) {
			nextSlideIndex = this.#slideArray.length - 1;
		} else {
			nextSlideIndex = this.#currentSlideIndex - 1;
		}	

		document.getElementById("slide" + nextSlideIndex).style.left = "-100%";
		document.getElementById("slide" + this.#currentSlideIndex).style.left = 0;
		
		document.getElementById("slide" + nextSlideIndex).setAttribute("class", "singleSlide slideInLeft");
		document.getElementById("slide" + this.#currentSlideIndex).setAttribute("class", "singleSlide slideOutRight");
		
		this.#currentSlideIndex = nextSlideIndex;
	}

	nextSlide(){
		var nextSlideIndex;

		if(this.#slideArray.length < 2){
			return;
		}

		if (this.#currentSlideIndex === (this.#slideArray.length - 1)) {
			nextSlideIndex = 0;
		} else {
			nextSlideIndex = this.#currentSlideIndex + 1;
		}	
		
		document.getElementById("slide" + nextSlideIndex).style.left = "100%";
		document.getElementById("slide" + this.#currentSlideIndex).style.left = 0;
		
		document.getElementById("slide" + nextSlideIndex).setAttribute("class", "singleSlide slideInRight");
		document.getElementById("slide" + this.#currentSlideIndex).setAttribute("class", "singleSlide slideOutLeft");
		
		this.#currentSlideIndex = nextSlideIndex;
	}
}

export { Slider };
