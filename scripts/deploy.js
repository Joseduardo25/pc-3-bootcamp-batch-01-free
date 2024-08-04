require("dotenv").config();

const {
  getRole,
  verify,
  ex,
  printAddress,
  deploySC,
  deploySCNoUp,
} = require("../utils");

var MINTER_ROLE = getRole("MINTER_ROLE");
var BURNER_ROLE = getRole("BURNER_ROLE");

async function deployMumbai() {
  //NOTA: ver como se genera el address del relayer
  var relayerAddress = "0xeb0868cf925105ac466c2b19039301e904061514";
  var nftContract = await deploySC("PC3NFTUpgradeable", [])
  var implementation = await printAddress("PC3NFTUpgradeable", nftContract.address);

  // set up
  await ex(nftTknContract, "grantRole", [MINTER_ROLE, relayerAddress], "GR");

  await verify(implementation, "PC3NFTUpgradeable", []);
}

async function deployGoerli() {
  // gnosis safe
  // Crear un gnosis safe en https://gnosis-safe.io/app/
  // Extraer el address del gnosis safe y pasarlo al contrato con un setter
  
  //falta colocar el addrress del gnosis safe
  var gnosis = { address: "" };
  
  //Desplegar el contrato stableCoin
  var usdcContract = await deploySCNoUp("USDCoin")
  verify(usdcContract.address, "USDC");
  console.log("USDC Contract Address: ", usdcContract.address);

  //Desplegar el token
  pc3Token = await deploySC("PC3TokenUpgradeable", []);
  var implementationpc3Token = await printAddress("PC3TOKEN", pc3Token.address);
  verify(implementationpc3Token, "PC3TokenUpgradeable");

  //Desplegar el contrato de compra y venta de NFTs
  publicSale = await deploySC("PublicSale", []);
  var implementationpublicSale = await printAddress("PublicSale", publicSale.address);
  verify(implementationpublicSale, "PublicSale", []);

  await ex(publicSale, "setPC3Token", [pc3Token.address], "SPC3");
  await ex(publicSale, "setGnosisWallet", [gnosis.address], "SGW");
  await ex(publicSale, "setNumberNFTs", [30], "SetUp Number NFTs");
}

deployMumbai()
// deployGoerli()
  //
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
