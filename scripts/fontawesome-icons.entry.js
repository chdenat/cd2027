/******************************************************************************
 * This file is part of the CD2027 project.
 *
 * File: scripts/fontawesome-icons.entry.js
 *
 * Author: Christian Denat
 * Email: christian.denat@orange.fr
 *
 * Created on: 2026-10-02
 * Last modified: 2026-11-02
 *
 * Copyright © 2026 Christian Denat
 ******************************************************************************/

/**
 * Browser bundle entry point and allowlist for icons used by templates and client modules.
 * Keep this registry narrow so unused Pro icon definitions are not shipped to visitors.
 */
import {
  faArrowLeft,
  faArrowRight,
  faBars,
  faBasketShopping,
  faBasketShoppingMinus,
  faBasketShoppingPlus,
  faBookOpen,
  faCalendarCircleExclamation,
  faCircleHalfStroke,
  faDesktop,
  faMessages,
  faMoon,
  faPalette,
  faPaperPlane,
  faPenClip,
  faPenFancy,
  faPlay,
  faRightFromBracket,
  faRightToBracket,
  faSquarePhoneFlip,
  faStar,
  faSunBright,
} from '@fortawesome/pro-solid-svg-icons'
import {
  faFacebook,
  faInstagram,
  faLinkedin,
  faPinterest,
  faYoutube,
} from '@fortawesome/free-brands-svg-icons'

export const fontAwesomeIconDefinitions = {
  solid: {
    'arrow-left': faArrowLeft,
    'arrow-right': faArrowRight,
    bars: faBars,
    'basket-shopping': faBasketShopping,
    'basket-shopping-minus': faBasketShoppingMinus,
    'basket-shopping-plus': faBasketShoppingPlus,
    'book-open': faBookOpen,
    'calendar-circle-exclamation': faCalendarCircleExclamation,
    'circle-half-stroke': faCircleHalfStroke,
    desktop: faDesktop,
    messages: faMessages,
    moon: faMoon,
    palette: faPalette,
    'paper-plane': faPaperPlane,
    'pen-clip': faPenClip,
    'pen-fancy': faPenFancy,
    play: faPlay,
    'right-from-bracket': faRightFromBracket,
    'right-to-bracket': faRightToBracket,
    'square-phone-flip': faSquarePhoneFlip,
    star: faStar,
    'sun-bright': faSunBright,
  },
  brands: {
    facebook: faFacebook,
    instagram: faInstagram,
    linkedin: faLinkedin,
    pinterest: faPinterest,
    youtube: faYoutube,
  },
}
